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
// Sin PUSH_ENABLED / claves → 503 `push_disabled`; sin migración → 503
// `push_unavailable`. Nada más se rompe.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { readPushConfig } from '@/lib/push/config'
import { subscribeSchema } from '@/lib/push/schemas'

const log = createLogger('api/push/subscribe')
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_DEVICES = 10
const MAX_BODY = 4096
const NOT_MIGRATED = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (isDemoUser(user)) return NextResponse.json({ error: 'demo_read_only' }, { status: 403 })

  const rl = checkRateLimit(`push:${user.id}`, LIMITS.settings)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  if (!readPushConfig().config) return NextResponse.json({ error: 'push_disabled' }, { status: 503 })

  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = subscribeSchema.safeParse(json)
  if (!parsed.success) {
    const notAllowed = parsed.error.issues.some((i) => i.message === 'endpoint_not_allowed')
    return NextResponse.json({ error: notAllowed ? 'endpoint_not_allowed' : 'invalid_subscription' }, { status: 400 })
  }
  const body = parsed.data
  if (body.expirationTime && body.expirationTime <= Date.now()) {
    return NextResponse.json({ error: 'subscription_expired' }, { status: 400 })
  }

  const { data: own, error: readError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, locale, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: true })
  if (readError) {
    if (NOT_MIGRATED.has(readError.code ?? '')) return NextResponse.json({ error: 'push_unavailable' }, { status: 503 })
    log.error('No se pudieron leer las suscripciones', { code: readError.code })
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
  const rows = (own ?? []) as { id: string; endpoint: string; locale: string }[]
  const replaced = body.replaces ? rows.find((r) => r.endpoint === body.replaces) : undefined
  const existing = rows.find((r) => r.endpoint === body.endpoint)

  // El navegador pasó a otra cuenta: la suscripción es de quien tiene la sesión.
  if (!existing) {
    const { error } = await createAdminClient()
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', body.endpoint)
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
    if (NOT_MIGRATED.has(error.code ?? '')) return NextResponse.json({ error: 'push_unavailable' }, { status: 503 })
    if (error.code === '42501') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    log.error('No se pudo guardar la suscripción', { code: error.code })
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: existing ? 200 : 201, headers: NO_STORE })
}
