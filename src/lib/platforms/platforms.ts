// ============================================================
// KULTURA — Mis plataformas (F-25, PRO-6): catálogo por región
//
// Ids de proveedor de TMDB (`watch/providers`, datos de JustWatch). Se guarda
// el id PRINCIPAL de cada plataforma en `user_streaming_services.services`
// (tabla privada: solo la lee y escribe su dueño); `aliases`
// son las variantes con las que TMDB la sirve en algunos países o títulos
// («Netflix basic with Ads», «Amazon Prime Video with Ads»…), que cuentan
// como la misma suscripción.
//
// Sin servidor ni red: lo usan Ajustes (navegador) e Inicio (servidor).
// Regiones: las mismas que `tmdbRegion` (es → ES, en → US).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export const PLATFORM_REGIONS = ['ES', 'US'] as const
export type PlatformRegion = (typeof PLATFORM_REGIONS)[number]

export interface Platform {
  /** Id principal de TMDB (el que se guarda). */
  id: number
  name: string
  /** Otros ids de TMDB que son la misma suscripción. */
  aliases?: number[]
}

/** Orden: lo más contratado primero (como en la ficha). */
export const PLATFORMS_BY_REGION: Record<PlatformRegion, Platform[]> = {
  ES: [
    { id: 8, name: 'Netflix', aliases: [1796] },
    { id: 119, name: 'Prime Video', aliases: [9, 2100] },
    { id: 337, name: 'Disney+' },
    { id: 1899, name: 'Max', aliases: [384] },
    // Mismo id que el filtro de Descubrir (`TMDB_PROVIDER`); 149 es el antiguo.
    { id: 2241, name: 'Movistar Plus+', aliases: [149] },
    { id: 350, name: 'Apple TV+' },
    { id: 63, name: 'Filmin' },
    { id: 1773, name: 'SkyShowtime' },
    { id: 283, name: 'Crunchyroll' },
  ],
  US: [
    { id: 8, name: 'Netflix', aliases: [1796] },
    { id: 119, name: 'Prime Video', aliases: [9, 2100] },
    { id: 337, name: 'Disney+' },
    { id: 1899, name: 'Max', aliases: [384] },
    { id: 15, name: 'Hulu' },
    { id: 350, name: 'Apple TV+' },
    { id: 531, name: 'Paramount+', aliases: [582, 1853] },
    { id: 386, name: 'Peacock', aliases: [387] },
    { id: 283, name: 'Crunchyroll' },
  ],
}

export const MAX_PLATFORMS = 30

export function isPlatformRegion(value: unknown): value is PlatformRegion {
  return typeof value === 'string' && (PLATFORM_REGIONS as readonly string[]).includes(value)
}

/** Región del catálogo: la guardada o, si no hay, la del idioma. */
export function platformRegionFor(saved: unknown, locale: string | null | undefined): PlatformRegion {
  if (isPlatformRegion(saved)) return saved
  return locale === 'en' ? 'US' : 'ES'
}

/** Lo guardado → ids válidos, sin repetidos ni basura (máx. 30). */
export function normalizeServices(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out: number[] = []
  for (const v of value) {
    const n = typeof v === 'string' ? Number(v) : v
    if (typeof n === 'number' && Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n)
    if (out.length >= MAX_PLATFORMS) break
  }
  return out
}

/** Todos los ids de TMDB que cuentan para las plataformas elegidas. */
export function expandServices(services: number[], region: PlatformRegion): Set<number> {
  const ids = new Set<number>(services)
  for (const p of PLATFORMS_BY_REGION[region]) {
    if (services.includes(p.id)) for (const alias of p.aliases ?? []) ids.add(alias)
  }
  return ids
}

/** Nombres (para "Esta noche en Netflix y Filmin"). Los ids desconocidos no salen. */
export function platformNames(services: number[], region: PlatformRegion): string[] {
  return PLATFORMS_BY_REGION[region].filter((p) => services.includes(p.id)).map((p) => p.name)
}

/**
 * Plataformas guardadas del usuario con SU sesión. `null` si la tabla aún no
 * existe (migración sin aplicar) o la lectura falla: quien llama no pinta
 * nada. Sin fila: ninguna marcada y la región del idioma.
 */
export async function readPlatforms(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string,
  locale: string | null | undefined
): Promise<{ services: number[]; region: PlatformRegion } | null> {
  const { data, error } = await supabase
    .from('user_streaming_services')
    .select('services, region')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  const row = data as { services?: unknown; region?: unknown } | null
  return { services: normalizeServices(row?.services), region: platformRegionFor(row?.region, locale) }
}
