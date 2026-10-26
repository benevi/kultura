// ============================================================
// KULTURA — Progreso por formato en el servidor (F-27)
//
// Bandera PROGRESS_V2=1 (Vercel) DESPUÉS de aplicar
// 20261215270001_progress.sql. Sin ella, todo como antes: solo progreso de
// episodios (series y anime) en el jsonb `episode_progress`. Con ella se
// escriben las columnas `progress_*` de todos los formatos; si la base aún
// no las tiene (bandera encendida antes de tiempo), se detecta por el código
// de error (`isNotMigrated`) y se vuelve a lo de antes en vez de dar un 500.
//
// El «plan» (cuántos episodios tiene cada temporada, capítulos, páginas,
// horas medias) sale del proveedor por los clientes de `src/lib/api`, que
// cachean la respuesta: la ficha de una serie ya pidió `/tv/{id}` con los
// mismos parámetros, así que lo normal es que no salga a la red.
// ============================================================

import { z } from 'zod'
import { env } from '@/lib/env.server'
import { getTV } from '@/lib/api/tmdb'
import { providerFetch } from '@/lib/api/http'
import { tmdbLanguage } from '@/lib/api/locale'
import { parseMediaId } from '@/lib/media/media-id'
import { resolveMediaItem } from '@/lib/media/resolve-item'
import { createLogger } from '@/lib/logger'
import { progressKindFor, type ProgressPlan, type SeasonPlan } from '@/lib/library/progress'

const log = createLogger('library/progress')

export function progressV2Enabled(): boolean {
  return process.env.PROGRESS_V2 === '1'
}

/** Lo justo de un cliente de Supabase para la sonda (sirve el de servidor y los mocks). */
interface ProbeClient {
  from(table: 'user_media'): {
    select(columns: string): { limit(n: number): PromiseLike<{ error: unknown }> }
  }
}

/**
 * ¿Tiene la base las columnas de 20261215270001? Sonda de una fila (sin
 * filas también responde sin error). Con la bandera encendida antes de
 * aplicar la migración devuelve false (42703) y todo sigue como antes.
 */
export async function progressColumnsExist(supabase: ProbeClient): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_media').select('progress_episode').limit(1)
    return !error
  } catch {
    return false
  }
}

/** PROGRESS_V2 encendida Y la migración aplicada (misma detección que el GET). */
export async function progressV2Active(supabase: ProbeClient): Promise<boolean> {
  return progressV2Enabled() && (await progressColumnsExist(supabase))
}

// ── TMDB: temporadas y episodios ─────────────────────────────────────────────

/** Partes de `/tv/{id}` que usa el progreso (la respuesta trae mucho más). */
export interface TmdbTvProgressFields {
  status?: string
  in_production?: boolean
  number_of_episodes?: number
  seasons?: { season_number: number; episode_count: number; air_date?: string | null }[]
  last_episode_to_air?: { season_number: number; episode_number: number } | null
  next_episode_to_air?: { season_number: number; episode_number: number; air_date?: string | null } | null
}

/** `/tv/{id}/season/{n}`: episodios con número, nombre y fecha de emisión. */
const tmdbSeasonSchema = z.looseObject({
  season_number: z.number(),
  episodes: z.array(
    z.looseObject({
      episode_number: z.number(),
      name: z.string().nullish(),
      air_date: z.string().nullish(),
    })
  ),
})
export type TmdbSeason = z.infer<typeof tmdbSeasonSchema>

/** Una temporada de TMDB (nombres de episodio y fechas). */
export async function getTvSeason(tvId: number, season: number, locale?: string | null): Promise<TmdbSeason> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tvId}/season/${season}`)
  url.searchParams.set('api_key', env.TMDB_API_KEY)
  url.searchParams.set('language', tmdbLanguage(locale))
  return providerFetch<TmdbSeason>('tmdb', url.toString(), {
    schema: tmdbSeasonSchema,
    label: '/tv/{id}/season/{n}',
  })
}

/** Estados de TMDB de una serie que ya no tendrá más episodios. */
const TV_ENDED = new Set(['Ended', 'Canceled'])

/** Plan de una serie a partir de la ficha de TMDB. */
export function tvPlanFromTmdb(tv: TmdbTvProgressFields): ProgressPlan {
  const seasons: SeasonPlan[] = (tv.seasons ?? [])
    .filter((s) => typeof s.season_number === 'number' && s.season_number >= 1 && (s.episode_count ?? 0) > 0)
    .map((s) => ({ number: s.season_number, episodes: s.episode_count }))
    .sort((a, b) => a.number - b.number)
  const ended = typeof tv.status === 'string' && TV_ENDED.has(tv.status)
  const last = tv.last_episode_to_air
  return {
    seasons,
    total: typeof tv.number_of_episodes === 'number' ? tv.number_of_episodes : null,
    ended,
    // En emisión, no se marca más allá de lo emitido. Terminada: no hace falta.
    lastAired:
      !ended && last && typeof last.season_number === 'number' && typeof last.episode_number === 'number'
        ? { season: last.season_number, episode: last.episode_number }
        : null,
  }
}

// ── Resto de formatos: la ficha normalizada ──────────────────────────────────

function positive(n: unknown): number | null {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.round(v) : null
}

/** Estados de «obra terminada» de AniList, Jikan y MangaDex. */
const FINISHED = /^(finished|finished airing|finished publishing|completed|ended)$/i

/**
 * Plan desde `MediaItem.metadata` (ver `normalizer.ts`): anime `episodes`,
 * manga `chapters`/`lastChapter` y `volumes`, cómic `issues`, libro
 * `pageCount`/`pages`, juego `playtime` (horas medias de RAWG).
 */
export function planFromMetadata(mediaType: string, metadata: Record<string, unknown> | undefined): ProgressPlan {
  const m = metadata ?? {}
  const ended = typeof m.status === 'string' && FINISHED.test(m.status)
  switch (progressKindFor(mediaType)) {
    case 'anime':
      return { total: positive(m.episodes), ended }
    case 'reading':
      return {
        total: positive(m.chapters) ?? positive(m.lastChapter) ?? positive(m.issues),
        volumes: positive(m.volumes),
        ended,
      }
    case 'book':
      return { total: positive(m.pageCount) ?? positive(m.pages) ?? positive(m.number_of_pages) }
    case 'game':
      return { total: positive(m.playtime) }
    default:
      return {}
  }
}

/**
 * Plan del título o `null` si el proveedor no responde (nunca lanza): sin
 * plan se avanza igual, solo que sin saber dónde acaba.
 */
export async function getProgressPlan(mediaId: string, locale: string): Promise<ProgressPlan | null> {
  const parsed = parseMediaId(mediaId)
  if (!parsed || !progressKindFor(parsed.type)) return null
  try {
    if (parsed.type === 'tv') {
      const id = Number(parsed.externalId)
      if (!Number.isInteger(id) || id <= 0) return null
      const tv = (await getTV(id, locale)) as unknown as TmdbTvProgressFields
      return tvPlanFromTmdb(tv)
    }
    const item = await resolveMediaItem(parsed, locale)
    return item ? planFromMetadata(parsed.type, item.metadata) : null
  } catch (err) {
    log.warn('sin plan de progreso del proveedor', { mediaId, err })
    return null
  }
}

/** Siguiente episodio con nombre (para el diálogo); null si TMDB no lo da. */
export async function nextEpisodeInfo(
  tvId: number,
  season: number,
  episode: number,
  locale: string
): Promise<{ season: number; episode: number; name: string | null; airDate: string | null } | null> {
  try {
    const data = await getTvSeason(tvId, season, locale)
    const ep = data.episodes.find((e) => e.episode_number === episode)
    if (!ep) return null
    return { season, episode, name: ep.name?.trim() || null, airDate: ep.air_date ?? null }
  } catch (err) {
    log.warn('sin temporada de TMDB', { tvId, season, err })
    return null
  }
}
