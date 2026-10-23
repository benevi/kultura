// ============================================================
// KULTURA — Eventos de producto (D-12, CRE-1b). SOLO SERVIDOR.
//
// Medición sin banner: los anónimos se cuentan con Vercel Web Analytics
// (páginas vistas, sin cookies) y aquí solo se registran acciones de usuarios
// REGISTRADOS, desde el servidor, en `analytics_events` (migración
// 20261115170001_analytics.sql). Nada se guarda en el navegador.
//
// `track()` nunca lanza ni bloquea de más: sin la tabla (42P01 / PGRST205),
// sin claves o si Supabase tarda, el evento se pierde y la petición sigue.
// La demo no deja rastro.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'

const log = createLogger('analytics')

/** Catálogo cerrado de eventos (lo que lee la vista `funnel_weekly`). */
export const ANALYTICS_EVENTS = [
  'signup_completed',
  'library_add',
  'rating_set',
  'list_made_public',
  'invite_accepted',
  'share',
] as const
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>

type TrackUser = { id: string; app_metadata?: Record<string, unknown> | null } | null | undefined

/** Lo que tarda como mucho un evento antes de darlo por perdido. */
export const TRACK_TIMEOUT_MS = 1500

/** "La tabla aún no existe": la migración no se ha aplicado. */
const NOT_MIGRATED = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/

/** Solo claves sencillas y valores cortos: nada de objetos ni textos libres largos. */
export function cleanProps(props: AnalyticsProps = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!KEY_RE.test(key) || value === null || value === undefined) continue
    if (typeof value === 'string') out[key] = value.slice(0, 120)
    else if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value
    } else out[key] = value
  }
  return out
}

function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    Promise.resolve(work),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`analytics timeout ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * Registra un evento de un usuario registrado. Devuelve `true` si quedó
 * guardado (o ya lo estaba, con `dedupeKey`).
 *
 * `dedupeKey`: los eventos que solo cuentan una vez (el alta, el primer
 * título de cada ficha, una lista hecha pública…) llevan una clave única; si
 * ya existe, no se duplica (`ON CONFLICT DO NOTHING`).
 */
export async function track(
  user: TrackUser,
  name: AnalyticsEvent,
  props?: AnalyticsProps,
  opts: { dedupeKey?: string } = {},
): Promise<boolean> {
  if (!user?.id || isDemoUser(user)) return false
  if (process.env.ANALYTICS_DISABLED === '1') return false
  try {
    const admin = createAdminClient()
    const row = {
      user_id: user.id,
      name,
      props: cleanProps(props),
      dedupe_key: opts.dedupeKey ?? null,
    }
    const table = admin.from('analytics_events')
    const query = opts.dedupeKey
      ? table.upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      : table.insert(row)
    const { error } = await withTimeout(query, TRACK_TIMEOUT_MS)
    if (error) {
      if (!NOT_MIGRATED.has(error.code ?? '')) {
        log.warn('analytics: evento no guardado', { name, code: error.code, message: error.message })
      }
      return false
    }
    return true
  } catch (e) {
    log.warn('analytics: evento perdido', { name, message: e instanceof Error ? e.message : String(e) })
    return false
  }
}
