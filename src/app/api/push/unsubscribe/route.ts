// ============================================================
// KULTURA — Route Handler: POST /api/push/unsubscribe (F-33)
//
// Con sesión. `{ endpoint }` da de baja ESTE navegador; `{ all: true }`, todos
// los de la persona. Solo borra filas propias (RLS + filtro por user_id).
// Funciona aunque PUSH_ENABLED esté apagado (darse de baja siempre se puede)
// y antes de la migración (no hay nada que borrar → `removed: 0`).
// Contrato: src/lib/api/contracts/push.ts (saneamiento 9).
// ============================================================

import { apiError, ok, parseBody, rateLimit, requireUser } from '@/lib/api/route'
import { unsubscribeSchema, type PushUnsubscribed } from '@/lib/api/contracts/push'
import { isNotMigrated } from '@/lib/supabase/not-migrated'
import { LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/push/unsubscribe')
const MAX_BODY = 2048

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user, supabase } = auth

  const limited = await rateLimit(request, { key: 'push', limit: LIMITS.settings, userId: user.id })
  if (limited) return limited

  const body = await parseBody(request, unsubscribeSchema, { maxBytes: MAX_BODY })
  if (!body.ok) return body.response

  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  if ('endpoint' in body.value) query = query.eq('endpoint', body.value.endpoint)
  const { data, error } = await query.select('id')
  if (error) {
    if (isNotMigrated(error)) return ok<PushUnsubscribed>({ removed: 0 })
    if (error.code === '42501') return apiError('forbidden')
    log.error('No se pudo borrar la suscripción', { code: error.code })
    return apiError('internal')
  }
  return ok<PushUnsubscribed>({ removed: (data ?? []).length }, { headers: { 'Cache-Control': 'no-store' } })
}
