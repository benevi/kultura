// ============================================================
// KULTURA — Route Handler: POST /api/push/subscribe (F-33)
//
// Con sesión. Guarda (o refresca) la suscripción Web Push de ESTE navegador:
//   { endpoint, keys: { p256dh, auth }, expirationTime?, locale?, replaces? }
// - zod + lista blanca de servicios push (anti-SSRF, src/lib/push/endpoint.ts);
//   la base tiene el mismo CHECK.
// - Se escribe con la sesión (RLS: solo las propias; la demo no puede, y el
//   middleware ya le corta los POST).
// - Mismo navegador, otra cuenta (se cerró sesión y entró otra persona): el
//   endpoint es único, así que la fila de la cuenta anterior se borra con el
//   cliente admin; el aviso es de quien tiene ahora la sesión.
// - `replaces`: el service worker manda el endpoint viejo en
//   `pushsubscriptionchange`; se borra el viejo y se conserva su idioma.
// - Como mucho MAX_DEVICES por persona: entra la nueva y sale la más antigua.
// Respuesta `{ data: null }` (201 si es nueva). Sin PUSH_ENABLED / claves →
// 503 `unavailable` + `push_disabled`; sin migración → 503 `unavailable` +
// `push_unavailable`. Nada más se rompe.
// Contrato: src/lib/api/contracts/push.ts (saneamiento 9).
// ============================================================

import { apiError, ok, parseBody, rateLimit, requireUser } from '@/lib/api/route'
import { PUSH_ERRORS, subscribeSchema } from '@/lib/api/contracts/push'
import { ACCOUNT_ERRORS } from '@/lib/account/errors'
import { isNotMigrated } from '@/lib/supabase/not-migrated'
import { createAdminClient } from '@/lib/supabase/admin'
import { LIMITS } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { readPushConfig } from '@/lib/push/config'

const log = createLogger('api/push/subscribe')
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_DEVICES = 10
const MAX_BODY = 4096

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user, supabase } = auth
  if (isDemoUser(user)) return apiError('forbidden', { message: ACCOUNT_ERRORS.demoReadOnly })

  const limited = await rateLimit(request, { key: 'push', limit: LIMITS.settings, userId: user.id })
  if (limited) return limited

  if (!readPushConfig().config) return apiError('unavailable', { message: PUSH_ERRORS.disabled })

  const parsed = await parseBody(request, subscribeSchema, { maxBytes: MAX_BODY })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  if (body.expirationTime && body.expirationTime <= Date.now()) {
    return apiError('invalid_input', { field: 'expirationTime', message: PUSH_ERRORS.expired })
  }

  const { data: own, error: readError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, locale, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: true })
  if (readError) {
    if (isNotMigrated(readError)) return apiError('unavailable', { message: PUSH_ERRORS.notMigrated })
    log.error('No se pudieron leer las suscripciones', { code: readError.code })
    return apiError('internal')
  }
  const rows = (own ?? []) as { id: string; endpoint: string; locale: string }[]
  const replaced = body.replaces ? rows.find((r) => r.endpoint === body.replaces) : undefined
  const existing = rows.find((r) => r.endpoint === body.endpoint)

  // El navegador pasó a otra cuenta: la suscripción es de quien tiene la sesión.
  // Saneamiento 4.7: solo se libera si llegan también sus claves (p256dh y
  // auth), que solo tiene ese navegador. Con el endpoint a secas, cualquiera
  // que lo conociera podía borrar la suscripción de otra cuenta.
  if (!existing) {
    const { error } = await createAdminClient()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', body.endpoint)
      .eq('p256dh', body.keys.p256dh)
      .eq('auth', body.keys.auth)
      .neq('user_id', user.id)
    if (error) log.warn('No se pudo liberar el endpoint de otra cuenta', { code: error.code })
  }

  // Las más antiguas salen para que, con la nueva, queden como mucho MAX_DEVICES.
  const others = rows.filter((r) => r.endpoint !== body.endpoint && r.id !== replaced?.id)
  const overflow = existing ? 0 : Math.max(0, others.length - (MAX_DEVICES - 1))
  const drop = [
    ...(replaced && replaced.endpoint !== body.endpoint ? [replaced.id] : []),
    ...others.slice(0, overflow).map((r) => r.id),
  ]
  if (drop.length) await supabase.from('push_subscriptions').delete().in('id', drop).eq('user_id', user.id)

  const locale = body.locale ?? (existing?.locale as 'es' | 'en' | undefined) ?? (replaced?.locale as 'es' | 'en' | undefined) ?? 'es'
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      locale: locale === 'en' ? 'en' : 'es',
      expires_at: body.expirationTime ? new Date(body.expirationTime).toISOString() : null,
      failures: 0,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    if (isNotMigrated(error)) return apiError('unavailable', { message: PUSH_ERRORS.notMigrated })
    if (error.code === '42501') return apiError('forbidden')
    log.error('No se pudo guardar la suscripción', { code: error.code })
    return apiError('internal')
  }

  return ok(null, { status: existing ? 200 : 201, headers: NO_STORE })
}
