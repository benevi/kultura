// ============================================================
// KULTURA — Calendario (F-28, PRO-12): datos de una persona (solo servidor)
//
// Lee de su biblioteca lo que está "en curso" o "pendiente" y pide las fechas
// (ver build.ts). Caché por persona de 1 h (Data Cache de Next, clave = id +
// huella de los títulos + idioma + región + día): si añade o cambia un título,
// la huella cambia y el calendario se recalcula al momento; si no, se reutiliza
// sin tocar a los proveedores. Las fechas de cada título tienen además su
// propia caché de 6 h compartida entre todos (sources.ts).
// ============================================================

import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readPlatforms } from '@/app/[locale]/(app)/settings/platforms'
import { createLogger } from '@/lib/logger'
import type { MediaType } from '@/types/media'
import { buildCalendar, type CalendarFetchers } from './build'
import {
  CALENDAR_DAYS_AHEAD,
  addDays,
  dateInZone,
  type CalendarCandidate,
  type CalendarResult,
  type CalendarStatus,
} from './types'

const log = createLogger('calendar')

/** Títulos de la biblioteca que se leen como mucho (los más recientes). */
export const CALENDAR_LIBRARY_LIMIT = 300
/** Caché del calendario de cada persona. */
export const CALENDAR_USER_REVALIDATE_SECONDS = 3600

const MEDIA_TYPES: ReadonlySet<string> = new Set(['movie', 'tv', 'anime', 'manga', 'game', 'book', 'comic'])

interface LibraryRow {
  media_id: string
  status: string
  updated_at: string | null
  media: { title: string | null; poster: string | null } | Array<{ title: string | null; poster: string | null }> | null
}

/** Filas de `user_media` → candidatos, primero "en curso", después pendientes. */
export function toCandidates(rows: LibraryRow[]): CalendarCandidate[] {
  const out: CalendarCandidate[] = []
  for (const row of rows) {
    const i = row.media_id.indexOf('_')
    if (i <= 0) continue
    const type = row.media_id.slice(0, i)
    if (!MEDIA_TYPES.has(type)) continue
    if (row.status !== 'in_progress' && row.status !== 'pending') continue
    const media = Array.isArray(row.media) ? row.media[0] : row.media
    out.push({
      mediaId: row.media_id,
      type: type as MediaType,
      externalId: row.media_id.slice(i + 1),
      title: media?.title?.trim() || row.media_id,
      poster: media?.poster ?? null,
      status: row.status as CalendarStatus,
    })
  }
  const rank = (s: CalendarStatus) => (s === 'in_progress' ? 0 : 1)
  // Orden estable: dentro de cada estado se conserva el de la consulta (más reciente primero).
  return out.map((c, idx) => ({ c, idx })).sort((a, b) => rank(a.c.status) - rank(b.c.status) || a.idx - b.idx).map((x) => x.c)
}

export async function readCalendarCandidates(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<CalendarCandidate[]> {
  const { data, error } = await supabase
    .from('user_media')
    .select('media_id, status, updated_at, media(title, poster)')
    .eq('user_id', userId)
    .in('status', ['in_progress', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(CALENDAR_LIBRARY_LIMIT)
  if (error) throw new Error(`calendar: user_media · ${error.message}`)
  return toCandidates((data ?? []) as unknown as LibraryRow[])
}

function fingerprint(candidates: CalendarCandidate[]): string {
  const h = createHash('sha256')
  for (const c of candidates) h.update(`${c.mediaId}|${c.status}\n`)
  return h.digest('base64url').slice(0, 22)
}

function isMissingIncrementalCache(e: unknown): boolean {
  return e instanceof Error && e.message.includes('incrementalCache missing')
}

export interface UserCalendarOptions {
  now?: Date
  /** Días hacia delante (la página 90; el correo, 7). */
  daysAhead?: number
  /** Presupuesto de peticiones (ver build.ts). */
  budget?: number
  fetchers?: CalendarFetchers
  /** Sin caché por persona (tests y el correo, que ya va de uno en uno). */
  cache?: boolean
}

/**
 * Calendario de una persona. `supabase` puede ser el cliente con su sesión
 * (página) o el admin (cron); en los dos casos solo se leen SUS filas.
 */
export async function getUserCalendar(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string,
  locale: string,
  opts: UserCalendarOptions = {}
): Promise<CalendarResult> {
  const now = opts.now ?? new Date()
  const today = dateInZone(now)
  const daysAhead = opts.daysAhead ?? CALENDAR_DAYS_AHEAD
  const [candidates, platforms] = await Promise.all([
    readCalendarCandidates(supabase, userId),
    // F-25: región guardada para los estrenos de cine; si no, la del idioma.
    readPlatforms(supabase, userId, locale).catch(() => null),
  ])
  const region = platforms?.region ?? (locale === 'en' ? 'US' : 'ES')
  const window = { today, until: addDays(today, daysAhead), now, region, locale }
  const run = () => buildCalendar(candidates, window, { budget: opts.budget, fetchers: opts.fetchers })

  if (candidates.length === 0) return { events: [], candidates: 0, checked: 0, failed: 0, today }
  if (opts.cache === false) return run()

  const cached = unstable_cache(
    async () => {
      const result = await run()
      // Un calendario con fallos no se guarda una hora: se reintenta en la siguiente visita.
      if (result.failed > 0) throw new PartialCalendar(result)
      return result
    },
    ['calendar-v1', userId, fingerprint(candidates), locale, region, today, String(daysAhead)],
    { revalidate: CALENDAR_USER_REVALIDATE_SECONDS, tags: [`calendar:${userId}`] }
  )
  try {
    return await cached()
  } catch (e) {
    if (e instanceof PartialCalendar) return e.result
    if (isMissingIncrementalCache(e)) return run()
    log.error('calendario: no se pudo calcular', { err: e })
    throw e
  }
}

class PartialCalendar extends Error {
  constructor(readonly result: CalendarResult) {
    super('partial calendar')
  }
}
