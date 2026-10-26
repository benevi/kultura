// ============================================================
// KULTURA — «¿Qué veo esta noche?» (F-25, PRO-6) — solo servidor
//
// De los pendientes de cine, series y anime que vienen de TMDB, cuáles están
// AHORA en las plataformas del usuario (suscripción, gratis o con anuncios;
// alquiler y compra no cuentan) en su región. La oferta de cada título se
// pide a TMDB con la caché de proveedores (24 h, `providerFetch`), así que
// Inicio solo paga la primera vez de cada título al día. Un fallo del
// proveedor deja ese título fuera, nunca rompe la página.
//
// El anime de AniList no tiene oferta en TMDB sin cruzar títulos (lo hace la
// ficha, F-15); aquí entra solo el anime servido por TMDB (`tmdb-<id>`).
// ============================================================

import { getMovieProviders, getTVProviders, type TmdbProvidersResponse } from '@/lib/api/tmdb'
import { fromTmdbAnimeRef, isTmdbAnimeId } from '@/lib/api/anime-tmdb'
import {
  PLATFORMS_BY_REGION,
  expandServices,
  type PlatformRegion,
} from '@/app/[locale]/(app)/settings/platforms'

/** Cuántos pendientes se comprueban como mucho por visita (TMDB: 1 petición cada uno). */
export const TONIGHT_MAX_CHECKS = 24

/** Modalidades que cubre una suscripción. */
const INCLUDED = ['flatrate', 'free', 'ads'] as const

export interface TonightCandidate {
  mediaId: string
  title: string
  poster: string | null
  type: string
}

export interface TonightPick extends TonightCandidate {
  /** Plataformas del usuario donde está (nombres del catálogo). */
  platforms: string[]
}

type ProviderEntry = { provider_id?: number; provider_name?: string }

/** `movie_550` → película 550; `tv_1399` → serie; `anime_tmdb-31911` → serie. */
export function tmdbRefOf(mediaId: string): { kind: 'movie' | 'tv'; id: number } | null {
  const sep = mediaId.indexOf('_')
  if (sep === -1) return null
  const type = mediaId.slice(0, sep)
  const ext = mediaId.slice(sep + 1)
  if ((type === 'movie' || type === 'tv') && /^\d+$/.test(ext)) return { kind: type, id: Number(ext) }
  if (type === 'anime' && isTmdbAnimeId(ext)) return { kind: 'tv', id: fromTmdbAnimeRef(ext) }
  return null
}

/** Plataformas del usuario que ofrecen el título en `region`. */
export function matchPlatforms(
  resp: TmdbProvidersResponse | null | undefined,
  services: number[],
  region: PlatformRegion
): string[] {
  const country = resp?.results?.[region] as Partial<Record<(typeof INCLUDED)[number], ProviderEntry[]>> | undefined
  if (!country || services.length === 0) return []
  const wanted = expandServices(services, region)
  const catalog = PLATFORMS_BY_REGION[region]
  const names: string[] = []
  for (const kind of INCLUDED) {
    for (const p of country[kind] ?? []) {
      if (typeof p?.provider_id !== 'number' || !wanted.has(p.provider_id)) continue
      const known = catalog.find((c) => c.id === p.provider_id || c.aliases?.includes(p.provider_id!))
      const name = known?.name ?? p.provider_name
      if (name && !names.includes(name)) names.push(name)
    }
  }
  return names
}

/** Los pendientes que se pueden ver esta noche, en el orden recibido. */
export async function availableTonight(
  candidates: TonightCandidate[],
  services: number[],
  region: PlatformRegion,
  locale: string,
  fetchers: {
    movie: (id: number) => Promise<TmdbProvidersResponse>
    tv: (id: number) => Promise<TmdbProvidersResponse>
  } = {
    movie: (id) => getMovieProviders(id, region, locale),
    tv: (id) => getTVProviders(id, region, locale),
  }
): Promise<TonightPick[]> {
  if (services.length === 0) return []
  const checkable = candidates
    .map((c) => ({ c, ref: tmdbRefOf(c.mediaId) }))
    .filter((x): x is { c: TonightCandidate; ref: { kind: 'movie' | 'tv'; id: number } } => x.ref !== null)
    .slice(0, TONIGHT_MAX_CHECKS)

  const results = await Promise.allSettled(
    checkable.map(({ ref }) => (ref.kind === 'movie' ? fetchers.movie(ref.id) : fetchers.tv(ref.id)))
  )
  const picks: TonightPick[] = []
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const platforms = matchPlatforms(r.value, services, region)
    if (platforms.length > 0) picks.push({ ...checkable[i].c, platforms })
  })
  return picks
}
