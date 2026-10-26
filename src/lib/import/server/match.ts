// ============================================================
// KULTURA — Emparejar filas importadas con el catálogo (F-26, servidor)
//
// Orden de preferencia, del más exacto al menos:
//   1. id de TMDB (formato de importación de Letterboxd) → sin petición.
//   2. IMDb ID / TheTVDB ID → TMDB `GET /find/{id}` (findByExternalId).
//   3. MAL ID → AniList `Page.media(idMal_in: […])`: 50 filas en UNA petición
//      (AniList es el proveedor con menos cupo). Si AniList no responde o le
//      falta el título, Jikan `/anime|manga/{id}` (MyAnimeList) uno a uno.
//   4. ISBN → Open Library `search.json?q=isbn:…`.
//   5. Título + año (TMDB, en inglés: Letterboxd y TV Time usan los títulos
//      en inglés de TMDB) o título + autor (Open Library), con las reglas
//      conservadoras de `title-match.ts`.
// Nada de lo que trae la fila se escribe en el catálogo: la ficha sale del
// proveedor (SEG-2). Los títulos para adultos quedan fuera (`excluded`).
// ============================================================

import 'server-only'
import { z } from 'zod'
import type { MediaItem } from '@/types/media'
import { providerFetch } from '@/lib/api/http'
import { findByExternalId, searchMovies, searchTV, type TmdbMovie, type TmdbTV } from '@/lib/api/tmdb'
import { normalizeAniListManga, type AniListManga, type AniListMedia } from '@/lib/api/anilist'
import { getAnime as getJikanAnime, getManga as getJikanManga } from '@/lib/api/jikan'
import { searchOpenLibrary, searchOpenLibraryByTitle, type OpenLibraryDoc } from '@/lib/api/openlibrary'
import {
  normalizeAnime,
  normalizeAniListAnime,
  normalizeBookOpenLibrary,
  normalizeMangaJikan,
  normalizeMovie,
  normalizeTV,
} from '@/lib/api/normalizer'
import { isNSFW } from '@/lib/api/nsfw-filter'
import type { TmdbMovieDetail, TmdbTVDetail } from '@/lib/api/tmdb'
import { authorKey, pickTitleMatch } from '../title-match'
import type { ImportItem, MatchMethod } from '../types'
import { BudgetExhausted, isNotFound, mapLimit, type ProviderBudget } from './budget'

export type MatchResult =
  | {
      status: 'matched'
      mediaId: string
      by: MatchMethod
      /**
       * Ficha ya normalizada en el idioma de la petición (o sin idioma, como
       * AniList): se escribe en `media` sin volver a pedirla. Sin ella, la
       * fila de `media` la crea `ensureMediaRows` pidiendo la ficha.
       */
      item?: MediaItem
    }
  | { status: 'unmatched' }
  | { status: 'excluded' }
  | { status: 'pending' }

export interface MatchContext {
  budget: ProviderBudget
  /** Idioma de la persona (`es`/`en`): el de las fichas nuevas del catálogo. */
  locale: 'es' | 'en'
}

const PENDING: MatchResult = { status: 'pending' }
const UNMATCHED: MatchResult = { status: 'unmatched' }
const EXCLUDED: MatchResult = { status: 'excluded' }

/** Corre `fn` y convierte "sin presupuesto / proveedor caído" en `pending`. */
async function guard(fn: () => Promise<MatchResult>): Promise<MatchResult> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof BudgetExhausted) return PENDING
    if (isNotFound(e)) return UNMATCHED
    return PENDING
  }
}

function matched(mediaId: string, by: MatchMethod, item?: MediaItem): MatchResult {
  if (item && isNSFW(item)) return EXCLUDED
  return { status: 'matched', mediaId, by, item }
}

// ── TMDB: cine y series ───────────────────────────────────────────────────────

const yearOf = (date: string | undefined | null) => {
  const y = Number(String(date ?? '').slice(0, 4))
  return Number.isInteger(y) && y > 1800 ? y : null
}

function fromTmdbMovie(raw: TmdbMovie, by: MatchMethod, prebuilt: boolean): MatchResult {
  if ((raw as { adult?: boolean }).adult) return EXCLUDED
  return matched(`movie_${raw.id}`, by, prebuilt ? normalizeMovie(raw as TmdbMovieDetail) : undefined)
}

function fromTmdbTv(raw: TmdbTV, by: MatchMethod, prebuilt: boolean): MatchResult {
  if ((raw as { adult?: boolean }).adult) return EXCLUDED
  return matched(`tv_${raw.id}`, by, prebuilt ? normalizeTV(raw as TmdbTVDetail) : undefined)
}

/** Idioma en que se busca por título: el de los títulos de Letterboxd / TV Time. */
const SEARCH_LOCALE = 'en'

async function matchScreen(item: ImportItem, ctx: MatchContext): Promise<MatchResult> {
  const kind = item.kind === 'tv' ? 'tv' : 'movie'
  if (item.ids?.tmdb) return { status: 'matched', mediaId: `${kind}_${item.ids.tmdb}`, by: 'tmdb' }

  const external = item.ids?.imdb
    ? { id: item.ids.imdb, source: 'imdb_id' as const, by: 'imdb' as const }
    : item.ids?.tvdb
      ? { id: String(item.ids.tvdb), source: 'tvdb_id' as const, by: 'tvdb' as const }
      : null
  if (external) {
    const found = await ctx.budget.call('tmdb', () => findByExternalId(external.id, external.source, ctx.locale))
    // El id manda sobre el tipo que diga el archivo (una "TV Movie" de IMDb
    // puede ser película en TMDB, y al revés).
    if (kind === 'movie' && found.movies[0]) return fromTmdbMovie(found.movies[0], external.by, true)
    if (found.tv[0]) return fromTmdbTv(found.tv[0], external.by, true)
    if (found.movies[0]) return fromTmdbMovie(found.movies[0], external.by, true)
    // TMDB no conoce el id: se intenta por título.
  }

  const prebuilt = ctx.locale === SEARCH_LOCALE
  if (kind === 'movie') {
    const res = await ctx.budget.call('tmdb', () => searchMovies(item.title, 1, SEARCH_LOCALE))
    const pick = pickTitleMatch(
      item,
      (res.results ?? []).map((r) => ({ value: r, titles: [r.title, r.original_title], year: yearOf(r.release_date) }))
    )
    return pick ? fromTmdbMovie(pick.value, 'title_year', prebuilt) : UNMATCHED
  }
  const res = await ctx.budget.call('tmdb', () => searchTV(item.title, 1, SEARCH_LOCALE))
  const pick = pickTitleMatch(
    item,
    (res.results ?? []).map((r) => ({ value: r, titles: [r.name, r.original_name], year: yearOf(r.first_air_date) }))
  )
  return pick ? fromTmdbTv(pick.value, item.year ? 'title_year' : 'title', prebuilt) : UNMATCHED
}

// ── MAL ID: AniList por lotes, Jikan de respaldo ─────────────────────────────

const ANILIST_ENDPOINT = 'https://graphql.anilist.co'
const ANILIST_PAGE = 50

/** Campos que piden `normalizeAniListAnime` / `normalizeAniListManga` (+ idMal e isAdult). */
const ANIME_FIELDS = `id idMal isAdult title { romaji english native } coverImage { extraLarge large }
  description(asHtml: false) genres averageScore seasonYear startDate { year } episodes status
  studios(isMain: true) { nodes { name } } trailer { id site } source`
const MANGA_FIELDS = `id idMal isAdult title { romaji english native } synonyms coverImage { extraLarge large }
  description(asHtml: false) genres averageScore popularity startDate { year } chapters volumes status format`

const byMalQuery = (type: 'ANIME' | 'MANGA') => `
  query ($ids: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(idMal_in: $ids, type: ${type}) { ${type === 'ANIME' ? ANIME_FIELDS : MANGA_FIELDS} }
    }
  }`

/** Contrato mínimo (como `schemas/anilist.ts`): `data.Page.media[]` con `id`. */
const anilistByMalSchema = z.looseObject({
  data: z.looseObject({
    Page: z.looseObject({ media: z.array(z.looseObject({ id: z.number() })) }),
  }),
})

type AniListByMal = (AniListMedia | AniListManga) & { idMal?: number | null; isAdult?: boolean | null }

function checkGraphQLErrors(json: unknown): void {
  const errors = (json as { errors?: Array<{ message?: string; status?: number }> } | null)?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    throw Object.assign(new Error(`AniList: ${errors[0]?.message ?? 'error'}`), { status: errors[0]?.status ?? 200 })
  }
}

/** AniList: hasta 50 MAL IDs por petición → idMal → ficha. */
async function anilistByMal(ids: number[], type: 'ANIME' | 'MANGA', ctx: MatchContext): Promise<Map<number, AniListByMal>> {
  const out = new Map<number, AniListByMal>()
  for (let i = 0; i < ids.length; i += ANILIST_PAGE) {
    const chunk = ids.slice(i, i + ANILIST_PAGE)
    const json = await ctx.budget.call('anilist', () =>
      providerFetch<{ data?: { Page?: { media?: AniListByMal[] } } }>('anilist', ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: byMalQuery(type), variables: { ids: chunk, perPage: ANILIST_PAGE } }),
        label: 'graphql idMal_in',
        schema: anilistByMalSchema,
        retries: 1,
        retryOn: new Set([500, 502, 503, 504]),
        checkBody: checkGraphQLErrors,
      })
    )
    for (const m of json.data?.Page?.media ?? []) if (typeof m.idMal === 'number') out.set(m.idMal, m)
  }
  return out
}

const JIKAN_ADULT = /hentai|rx\b/i

async function jikanByMal(item: ImportItem, mal: number, ctx: MatchContext): Promise<MatchResult> {
  return guard(async () => {
    if (item.kind === 'anime') {
      const { data } = await ctx.budget.call('jikan', () => getJikanAnime(mal))
      if (JIKAN_ADULT.test(String((data as { rating?: string }).rating ?? ''))) return EXCLUDED
      return matched(`anime_${mal}`, 'mal', normalizeAnime(data))
    }
    const { data } = await ctx.budget.call('jikan', () => getJikanManga(mal))
    return matched(`manga_${mal}`, 'mal', normalizeMangaJikan(data))
  })
}

async function matchMal(items: ImportItem[], ctx: MatchContext): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()
  for (const kind of ['anime', 'manga'] as const) {
    const group = items.filter((i) => i.kind === kind && i.ids?.mal)
    if (group.length === 0) continue
    let found: Map<number, AniListByMal> | null = null
    try {
      found = await anilistByMal(
        group.map((i) => i.ids!.mal!),
        kind === 'anime' ? 'ANIME' : 'MANGA',
        ctx
      )
    } catch {
      found = null // AniList caído o sin presupuesto: Jikan.
    }
    await mapLimit(group, 2, async (item) => {
      const mal = item.ids!.mal!
      const media = found?.get(mal)
      if (media) {
        if (media.isAdult) return results.set(item.key, EXCLUDED)
        const normalized =
          kind === 'anime' ? normalizeAniListAnime(media as AniListMedia) : normalizeAniListManga(media as AniListManga)
        return results.set(item.key, matched(normalized.id, 'mal', normalized))
      }
      results.set(item.key, await jikanByMal(item, mal, ctx))
    })
  }
  // Anime/manga sin MAL ID (no debería pasar con un XML de MAL): sin emparejar.
  for (const item of items) if (!results.has(item.key)) results.set(item.key, UNMATCHED)
  return results
}

// ── Libros: ISBN y título + autor en Open Library ────────────────────────────

const workId = (doc: OpenLibraryDoc) => doc.key.replace(/^\/works\//, '')
const isWork = (doc: OpenLibraryDoc | undefined): doc is OpenLibraryDoc => !!doc && /^\/works\/OL\d+W$/.test(doc.key)

function fromBook(doc: OpenLibraryDoc, by: MatchMethod): MatchResult {
  return matched(`book_${workId(doc)}`, by, normalizeBookOpenLibrary(doc))
}

async function matchBook(item: ImportItem, ctx: MatchContext): Promise<MatchResult> {
  for (const isbn of (item.ids?.isbn ?? []).slice(0, 2)) {
    const res = await ctx.budget.call('openlibrary', () => searchOpenLibrary(`isbn:${isbn}`, 1, {}, 1))
    const doc = res.docs?.[0]
    if (isWork(doc)) return fromBook(doc, 'isbn')
  }

  const res = await ctx.budget.call('openlibrary', () => searchOpenLibraryByTitle(item.title.split(':')[0], 1, 10))
  const wantedAuthor = authorKey(item.author)
  const docs = (res.docs ?? []).filter(isWork)
  const byAuthor = wantedAuthor ? docs.filter((d) => (d.author_name ?? []).some((a) => authorKey(a) === wantedAuthor)) : []
  // Con autor coincidente el año no se exige (Open Library guarda el de la
  // primera edición que conoce, que a menudo no es el de Goodreads).
  const pool = byAuthor.length > 0 ? byAuthor : wantedAuthor ? [] : docs
  const toCandidate = (d: OpenLibraryDoc) => ({ value: d, titles: [d.title], year: d.first_publish_year ?? null })
  const wanted = { title: item.title, year: byAuthor.length > 0 ? undefined : item.year }
  const pick =
    pickTitleMatch(wanted, pool.map(toCandidate)) ??
    pickTitleMatch({ ...wanted, title: item.title.split(':')[0] }, pool.map(toCandidate))
  return pick ? fromBook(pick.value, 'title') : UNMATCHED
}

// ── Entrada ───────────────────────────────────────────────────────────────────

/** Empareja un lote. Nunca lanza: lo que no se resuelve ahora es `pending`. */
export async function matchItems(items: ImportItem[], ctx: MatchContext): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()
  const anime = items.filter((i) => i.kind === 'anime' || i.kind === 'manga')
  const rest = items.filter((i) => i.kind !== 'anime' && i.kind !== 'manga')

  const [malResults] = await Promise.all([
    anime.length > 0 ? matchMal(anime, ctx) : Promise.resolve(new Map<string, MatchResult>()),
    // El tope por proveedor lo pone el presupuesto; aquí, cuántas filas a la vez.
    mapLimit(rest, 8, async (item) => {
      results.set(item.key, await guard(() => (item.kind === 'book' ? matchBook(item, ctx) : matchScreen(item, ctx))))
    }),
  ])
  malResults.forEach((r, key) => results.set(key, r))
  return results
}
