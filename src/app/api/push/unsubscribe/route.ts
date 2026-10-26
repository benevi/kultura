// ============================================================
// KULTURA — Route Handler: POST /api/push/unsubscribe (F-33)
//
// Con sesión. `{ endpoint }` da de baja ESTE navegador; `{ all: true }`, todos
// los de la persona. Solo borra filas propias (RLS + filtro por user_id).
// Funciona aunque PUSH_ENABLED esté apagado (darse de baja siempre se puede)
// y antes de la migración (no hay nada que borrar → ok).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { unsubscribeSchema } from '@/lib/push/schemas'

const log = createLogger('api/push/unsubscribe')
const NOT_MIGRATED = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])
const MAX_BODY = 2048

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`push:${user.id}`, LIMITS.settings)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = unsubscribeSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  if ('endpoint' in parsed.data) query = query.eq('endpoint', parsed.data.endpoint)
  const { data, error } = await query.select('id')
  if (error) {
    if (NOT_MIGRATED.has(error.code ?? '')) return NextResponse.json({ ok: true, removed: 0 })
    if (error.code === '42501') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    log.error('No se pudo borrar la suscripción', { code: error.code })
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, removed: (data ?? []).length }, { headers: { 'Cache-Control': 'no-store' } })
}
