// ============================================================
// KULTURA — Calendario (F-28, PRO-12): fechas desde los proveedores
//
// Una petición mínima por título (TMDB, RAWG, MangaDex) o UNA para todos los
// de AniList (consulta por lotes con `id_in` / `idMal_in`), por la capa común
// `providerFetch` (plazo, breaker, cupos y caché de datos de Next). Los datos
// de cada título se reutilizan 6 h entre todas las personas que lo tienen.
//
// Los `parse*` son puros: convierten la respuesta oficial de cada API en
// eventos del calendario, y son lo que prueban los tests con respuestas de
// ejemplo de la documentación (el proxy de desarrollo no deja llegar a los
// proveedores; `scripts/check-calendar-sources.sh` las contrasta con las APIs
// reales desde una máquina con salida).
//
// Documentación de referencia:
//   TMDB  /tv/{id}          next_episode_to_air, last_episode_to_air, first_air_date
//         /movie/{id}       release_date + append_to_response=release_dates
//                           (type 2/3 = cines, 4 = digital) — developer.themoviedb.org
//   RAWG  /games/{id}       released (AAAA-MM-DD | null), tba — api.rawg.io/docs
//   AniList GraphQL Media   nextAiringEpisode { airingAt episode }, status,
//                           startDate { year month day } — docs.anilist.co
//   MangaDex /manga/{id}/feed  data[].attributes { chapter, translatedLanguage,
//                           publishAt, readableAt } — api.mangadex.org/docs
// ============================================================

import { z } from 'zod'
import { env } from '@/lib/env.server'
import { providerFetch } from '@/lib/api/http'
import { tmdbLanguage } from '@/lib/api/locale'
import { fromAniListRef, isAniListId } from '@/lib/api/anilist'
import { isTmdbAnimeId } from '@/lib/api/anime-tmdb'
import { isMangaDexId } from '@/lib/api/mangadex'
import {
  CALENDAR_DAYS_BACK,
  addDays,
  dateInZone,
  isIsoDay,
  timeInZone,
  type CalendarCandidate,
  type CalendarEvent,
  type CalendarKind,
  type DatePrecision,
} from './types'

/** Las fechas de un título cambian poco: 6 h compartidas entre todos. */
export const CALENDAR_PROVIDER_REVALIDATE_SECONDS = 6 * 3600
const CACHE = { revalidate: CALENDAR_PROVIDER_REVALIDATE_SECONDS }

/** Máximo de ids por consulta de AniList (su `perPage` máximo es 50). */
export const ANILIST_BATCH = 50

// ── Contratos mínimos (permisivos: solo vigilan, no transforman) ───────────

const tmdbEpisode = z
  .looseObject({
    air_date: z.string().nullable().optional(),
    episode_number: z.number().optional(),
    season_number: z.number().optional(),
    name: z.string().nullable().optional(),
  })
  .nullable()
  .optional()

export const tmdbTvCalendarSchema = z.looseObject({
  id: z.number(),
  first_air_date: z.string().nullable().optional(),
  next_episode_to_air: tmdbEpisode,
  last_episode_to_air: tmdbEpisode,
})

export const tmdbMovieCalendarSchema = z.looseObject({
  id: z.number(),
  release_date: z.string().nullable().optional(),
  release_dates: z
    .looseObject({
      results: z.array(
        z.looseObject({
          iso_3166_1: z.string(),
          release_dates: z.array(z.looseObject({ release_date: z.string(), type: z.number() })),
        })
      ),
    })
    .optional(),
})

export const rawgGameCalendarSchema = z.looseObject({
  id: z.number(),
  released: z.string().nullable().optional(),
  tba: z.boolean().optional(),
})

const anilistDate = z
  .looseObject({ year: z.number().nullable(), month: z.number().nullable(), day: z.number().nullable() })
  .nullable()
  .optional()

const anilistCalendarMedia = z.looseObject({
  id: z.number(),
  idMal: z.number().nullable().optional(),
  type: z.string().optional(),
  status: z.string().nullable().optional(),
  startDate: anilistDate,
  nextAiringEpisode: z.looseObject({ airingAt: z.number(), episode: z.number() }).nullable().optional(),
})

export const anilistCalendarSchema = z.looseObject({
  data: z.record(z.string(), z.looseObject({ media: z.array(anilistCalendarMedia) }).nullable()),
})

export const mangadexFeedSchema = z.looseObject({
  data: z.array(
    z.looseObject({
      attributes: z.looseObject({
        chapter: z.string().nullable().optional(),
        translatedLanguage: z.string().optional(),
        publishAt: z.string().optional(),
        readableAt: z.string().optional(),
      }),
    })
  ),
})

export type TmdbTvCalendar = z.infer<typeof tmdbTvCalendarSchema>
export type TmdbMovieCalendar = z.infer<typeof tmdbMovieCalendarSchema>
export type RawgGameCalendar = z.infer<typeof rawgGameCalendarSchema>
export type AniListCalendarMedia = z.infer<typeof anilistCalendarMedia>
export type MangaDexFeed = z.infer<typeof mangadexFeedSchema>

/** Ventana que interesa: desde hace una semana hasta `until` (incluido). */
export interface CalendarWindow {
  today: string
  until: string
  /** Para los instantes de AniList/MangaDex ("¿ya ha salido?"). */
  now: Date
  /** País para las fechas de estreno de películas (ES, US…). */
  region: string
  locale: string
}

function inWindow(day: string, w: CalendarWindow): boolean {
  return day >= addDays(w.today, -CALENDAR_DAYS_BACK) && day <= w.until
}

/**
 * ¿Está por llegar? Un día, dentro de la ventana. Un mes o un año sin día
 * exacto, mientras no haya terminado (aunque caiga más allá de la ventana:
 * va en "Más adelante").
 */
function isUpcoming(date: string, precision: DatePrecision, w: CalendarWindow): boolean {
  if (precision === 'day') return date >= w.today && date <= w.until
  if (precision === 'month') return date.slice(0, 7) >= w.today.slice(0, 7)
  if (precision === 'year') return date.slice(0, 4) >= w.today.slice(0, 4)
  return true
}

function event(
  c: CalendarCandidate,
  kind: CalendarKind,
  key: string,
  date: string | null,
  precision: DatePrecision,
  extra: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id: `${c.mediaId}:${kind}:${key}`,
    mediaId: c.mediaId,
    type: c.type,
    title: c.title,
    poster: c.poster,
    status: c.status,
    kind,
    date,
    precision,
    ...extra,
  }
}

// ── TMDB: series (y anime con id de TMDB) ──────────────────────────────────

export function parseTmdbTv(c: CalendarCandidate, raw: TmdbTvCalendar, w: CalendarWindow): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const next = raw.next_episode_to_air
  if (next && isIsoDay(next.air_date) && next.air_date >= w.today && next.air_date <= w.until) {
    const season = next.season_number ?? null
    const episode = next.episode_number ?? null
    const kind: CalendarKind =
      episode === 1 ? (season !== null && season > 1 ? 'season_premiere' : 'series_premiere') : 'episode'
    // Pendiente: solo interesa cuándo empieza (serie o temporada nueva).
    if (c.status === 'in_progress' || kind !== 'episode') {
      out.push(
        event(c, kind, `s${season ?? 0}e${episode ?? 0}`, next.air_date, 'day', {
          season,
          episode,
          episodeName: next.name?.trim() || null,
        })
      )
    }
  }
  const last = raw.last_episode_to_air
  if (c.status === 'in_progress' && last && isIsoDay(last.air_date) && last.air_date < w.today && inWindow(last.air_date, w)) {
    out.push(
      event(c, 'episode', `s${last.season_number ?? 0}e${last.episode_number ?? 0}`, last.air_date, 'day', {
        season: last.season_number ?? null,
        episode: last.episode_number ?? null,
        episodeName: last.name?.trim() || null,
      })
    )
  }
  // Serie pendiente que aún no se ha estrenado y sin episodio anunciado.
  if (out.length === 0 && c.status === 'pending' && isIsoDay(raw.first_air_date) && raw.first_air_date >= w.today && raw.first_air_date <= w.until) {
    out.push(event(c, 'series_premiere', 'first', raw.first_air_date, 'day', { season: 1, episode: 1 }))
  }
  return out
}

// ── TMDB: películas ────────────────────────────────────────────────────────

/** Tipos de `release_dates` de TMDB: 2 = cines (limitado), 3 = cines, 4 = digital. */
const THEATRICAL = new Set([2, 3])
const DIGITAL = 4

export function parseTmdbMovie(c: CalendarCandidate, raw: TmdbMovieCalendar, w: CalendarWindow): CalendarEvent[] {
  if (c.status !== 'pending') return []
  const regional = raw.release_dates?.results.find((r) => r.iso_3166_1 === w.region)?.release_dates ?? []
  const firstFrom = (types: (t: number) => boolean) =>
    regional
      .filter((d) => types(d.type))
      .map((d) => d.release_date.slice(0, 10))
      .filter((d) => isIsoDay(d))
      .sort()[0]

  const out: CalendarEvent[] = []
  const theatrical = firstFrom((t) => THEATRICAL.has(t))
  const digital = firstFrom((t) => t === DIGITAL)
  if (theatrical && theatrical >= w.today && theatrical <= w.until) {
    out.push(event(c, 'theatrical', w.region, theatrical, 'day', { region: w.region }))
  }
  if (digital && digital >= w.today && digital <= w.until) {
    out.push(event(c, 'digital', w.region, digital, 'day', { region: w.region }))
  }
  // Sin fechas para el país: la general de TMDB, si está por llegar.
  if (!theatrical && !digital && isIsoDay(raw.release_date) && raw.release_date >= w.today && raw.release_date <= w.until) {
    out.push(event(c, 'release', 'general', raw.release_date, 'day'))
  }
  return out
}

// ── RAWG: juegos ───────────────────────────────────────────────────────────

export function parseRawgGame(c: CalendarCandidate, raw: RawgGameCalendar, w: CalendarWindow): CalendarEvent[] {
  if (c.status !== 'pending') return []
  const released = isIsoDay(raw.released) ? raw.released : null
  if (raw.tba) {
    // RAWG marca "por anunciar" y a veces pone el 31 de diciembre del año
    // previsto: eso es un año, no un día.
    const year = released ? `${released.slice(0, 4)}-01-01` : null
    if (year && isUpcoming(year, 'year', w)) {
      return [event(c, 'release', 'tba', year, 'year')]
    }
    return [event(c, 'release', 'tba', null, 'tba')]
  }
  if (released && released >= w.today && released <= w.until) {
    return [event(c, 'release', 'day', released, 'day')]
  }
  return []
}

// ── AniList: anime y manga ─────────────────────────────────────────────────

function anilistStart(d: AniListCalendarMedia['startDate']): { date: string; precision: DatePrecision } | null {
  if (!d?.year) return null
  const mm = String(d.month ?? 1).padStart(2, '0')
  const dd = String(d.day ?? 1).padStart(2, '0')
  const date = `${d.year}-${mm}-${dd}`
  if (!isIsoDay(date)) return null
  return { date, precision: d.month ? (d.day ? 'day' : 'month') : 'year' }
}

export function parseAniList(c: CalendarCandidate, raw: AniListCalendarMedia, w: CalendarWindow): CalendarEvent[] {
  const next = raw.nextAiringEpisode
  if (next && Number.isFinite(next.airingAt)) {
    const instant = new Date(next.airingAt * 1000)
    const date = dateInZone(instant)
    const kind: CalendarKind = next.episode === 1 ? 'series_premiere' : 'episode'
    if (date >= w.today && date <= w.until && (c.status === 'in_progress' || kind === 'series_premiere')) {
      return [event(c, kind, `e${next.episode}`, date, 'day', { episode: next.episode, time: timeInZone(instant) })]
    }
    return []
  }
  if (raw.status === 'NOT_YET_RELEASED') {
    const start = anilistStart(raw.startDate)
    if (!start) return c.status === 'pending' ? [event(c, 'series_premiere', 'tba', null, 'tba')] : []
    if (isUpcoming(start.date, start.precision, w)) {
      return [event(c, 'series_premiere', 'start', start.date, start.precision)]
    }
  }
  return []
}

// ── MangaDex: capítulos ────────────────────────────────────────────────────

/** Idiomas de capítulo que se miran, por orden de preferencia. */
export function mangadexLanguages(locale: string): string[] {
  return locale === 'en' ? ['en', 'es', 'es-la'] : ['es', 'es-la', 'en']
}

export function parseMangaDexFeed(c: CalendarCandidate, raw: MangaDexFeed, w: CalendarWindow): CalendarEvent[] {
  const langs = mangadexLanguages(w.locale)
  const rank = (lang: string | undefined) => {
    const i = langs.indexOf(lang ?? '')
    return i === -1 ? langs.length : i
  }
  // Un capítulo sale en varios idiomas: se queda el del idioma preferido.
  const byChapter = new Map<string, { chapter: string; at: Date; rank: number }>()
  for (const item of raw.data) {
    const a = item.attributes
    const chapter = a.chapter?.trim()
    const stamp = a.readableAt ?? a.publishAt
    if (!chapter || !stamp) continue
    const at = new Date(stamp)
    if (Number.isNaN(at.getTime())) continue
    const r = rank(a.translatedLanguage)
    const prev = byChapter.get(chapter)
    if (!prev || r < prev.rank) byChapter.set(chapter, { chapter, at, rank: r })
  }

  const chapters = [...byChapter.values()]
  const released = chapters
    .filter((ch) => ch.at <= w.now)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0]
  const upcoming = chapters
    .filter((ch) => ch.at > w.now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0]

  const out: CalendarEvent[] = []
  for (const ch of [released, upcoming]) {
    if (!ch) continue
    const date = dateInZone(ch.at)
    if (!inWindow(date, w)) continue
    out.push(event(c, 'chapter', ch.chapter, date, 'day', { chapter: ch.chapter, time: ch.at > w.now ? timeInZone(ch.at) : null }))
  }
  return out
}

// ── Peticiones ─────────────────────────────────────────────────────────────

/** Cómo se consulta cada título (o null: este formato/fuente no tiene fechas). */
export type SourcePlan =
  | { source: 'tmdb_tv'; id: number }
  | { source: 'tmdb_movie'; id: number }
  | { source: 'rawg'; id: number }
  | { source: 'mangadex'; id: string }
  | { source: 'anilist'; id: number; by: 'id' | 'mal'; mediaType: 'ANIME' | 'MANGA' }

const NUMERIC = /^\d{1,10}$/

export function planFor(c: CalendarCandidate): SourcePlan | null {
  const id = c.externalId
  switch (c.type) {
    case 'tv':
      return NUMERIC.test(id) ? { source: 'tmdb_tv', id: Number(id) } : null
    case 'movie':
      return NUMERIC.test(id) ? { source: 'tmdb_movie', id: Number(id) } : null
    case 'game':
      return NUMERIC.test(id) ? { source: 'rawg', id: Number(id) } : null
    case 'anime':
      if (isTmdbAnimeId(id)) return { source: 'tmdb_tv', id: Number(id.slice(5)) }
      if (isAniListId(id)) return { source: 'anilist', id: fromAniListRef(id), by: 'id', mediaType: 'ANIME' }
      return NUMERIC.test(id) ? { source: 'anilist', id: Number(id), by: 'mal', mediaType: 'ANIME' } : null
    case 'manga':
      if (isMangaDexId(id)) return { source: 'mangadex', id }
      if (isAniListId(id)) return { source: 'anilist', id: fromAniListRef(id), by: 'id', mediaType: 'MANGA' }
      return NUMERIC.test(id) ? { source: 'anilist', id: Number(id), by: 'mal', mediaType: 'MANGA' } : null
    default:
      // Libros y cómics: sus APIs no dan fechas futuras fiables.
      return null
  }
}

export async function fetchTmdbTv(id: number, locale: string): Promise<TmdbTvCalendar> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${id}`)
  url.searchParams.set('api_key', env.TMDB_API_KEY)
  url.searchParams.set('language', tmdbLanguage(locale))
  return providerFetch<TmdbTvCalendar>('tmdb', url.toString(), {
    schema: tmdbTvCalendarSchema,
    label: '/tv/{id} (calendario)',
    cache: CACHE,
  })
}

export async function fetchTmdbMovie(id: number): Promise<TmdbMovieCalendar> {
  const url = new URL(`https://api.themoviedb.org/3/movie/${id}`)
  url.searchParams.set('api_key', env.TMDB_API_KEY)
  url.searchParams.set('append_to_response', 'release_dates')
  return providerFetch<TmdbMovieCalendar>('tmdb', url.toString(), {
    schema: tmdbMovieCalendarSchema,
    label: '/movie/{id} (calendario)',
    cache: CACHE,
  })
}

export async function fetchRawgGame(id: number): Promise<RawgGameCalendar> {
  const url = new URL(`https://api.rawg.io/api/games/${id}`)
  url.searchParams.set('key', env.RAWG_API_KEY)
  return providerFetch<RawgGameCalendar>('rawg', url.toString(), {
    schema: rawgGameCalendarSchema,
    label: '/games/{id} (calendario)',
    cache: CACHE,
  })
}

export async function fetchMangaDexFeed(id: string, locale: string): Promise<MangaDexFeed> {
  const url = new URL(`https://api.mangadex.org/manga/${id}/feed`)
  url.searchParams.set('limit', '12')
  url.searchParams.set('order[readableAt]', 'desc')
  url.searchParams.set('includeFutureUpdates', '1')
  for (const lang of mangadexLanguages(locale)) url.searchParams.append('translatedLanguage[]', lang)
  for (const rating of ['safe', 'suggestive', 'erotica']) url.searchParams.append('contentRating[]', rating)
  return providerFetch<MangaDexFeed>('mangadex', url.toString(), {
    schema: mangadexFeedSchema,
    label: '/manga/{id}/feed (calendario)',
    cache: CACHE,
  })
}

const ANILIST_FIELDS = 'id idMal type status startDate { year month day } nextAiringEpisode { airingAt episode }'

/**
 * Una sola consulta GraphQL para todos los ids de AniList (por id propio y por
 * id de MAL, que es por tipo). Devuelve un mapa `clave → media`, con clave
 * `id:123` o `mal:ANIME:456`.
 */
export function buildAniListQuery(plans: Array<Extract<SourcePlan, { source: 'anilist' }>>): {
  query: string
  variables: Record<string, number[]>
} | null {
  const ids = [...new Set(plans.filter((p) => p.by === 'id').map((p) => p.id))].slice(0, ANILIST_BATCH)
  const malAnime = [...new Set(plans.filter((p) => p.by === 'mal' && p.mediaType === 'ANIME').map((p) => p.id))].slice(0, ANILIST_BATCH)
  const malManga = [...new Set(plans.filter((p) => p.by === 'mal' && p.mediaType === 'MANGA').map((p) => p.id))].slice(0, ANILIST_BATCH)
  const parts: string[] = []
  const defs: string[] = []
  const variables: Record<string, number[]> = {}
  if (ids.length) {
    defs.push('$ids: [Int]')
    parts.push(`byId: Page(perPage: ${ANILIST_BATCH}) { media(id_in: $ids) { ${ANILIST_FIELDS} } }`)
    variables.ids = ids
  }
  if (malAnime.length) {
    defs.push('$malAnime: [Int]')
    parts.push(`malAnime: Page(perPage: ${ANILIST_BATCH}) { media(idMal_in: $malAnime, type: ANIME) { ${ANILIST_FIELDS} } }`)
    variables.malAnime = malAnime
  }
  if (malManga.length) {
    defs.push('$malManga: [Int]')
    parts.push(`malManga: Page(perPage: ${ANILIST_BATCH}) { media(idMal_in: $malManga, type: MANGA) { ${ANILIST_FIELDS} } }`)
    variables.malManga = malManga
  }
  if (!parts.length) return null
  return { query: `query (${defs.join(', ')}) { ${parts.join(' ')} }`, variables }
}

export function indexAniList(raw: z.infer<typeof anilistCalendarSchema>): Map<string, AniListCalendarMedia> {
  const out = new Map<string, AniListCalendarMedia>()
  for (const [alias, page] of Object.entries(raw.data)) {
    for (const media of page?.media ?? []) {
      if (alias === 'byId') out.set(`id:${media.id}`, media)
      else if (alias === 'malAnime' && media.idMal) out.set(`mal:ANIME:${media.idMal}`, media)
      else if (alias === 'malManga' && media.idMal) out.set(`mal:MANGA:${media.idMal}`, media)
    }
  }
  return out
}

export function anilistKey(p: Extract<SourcePlan, { source: 'anilist' }>): string {
  return p.by === 'id' ? `id:${p.id}` : `mal:${p.mediaType}:${p.id}`
}

export async function fetchAniListBatch(
  plans: Array<Extract<SourcePlan, { source: 'anilist' }>>
): Promise<Map<string, AniListCalendarMedia>> {
  const built = buildAniListQuery(plans)
  if (!built) return new Map()
  const raw = await providerFetch<z.infer<typeof anilistCalendarSchema>>('anilist', 'https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(built),
    schema: anilistCalendarSchema,
    label: 'graphql (calendario)',
    cache: CACHE,
    checkBody: (json) => {
      const errors = (json as { errors?: unknown[] } | null)?.errors
      if (Array.isArray(errors) && errors.length > 0) throw new Error('AniList GraphQL errors')
    },
  })
  return indexAniList(raw)
}
