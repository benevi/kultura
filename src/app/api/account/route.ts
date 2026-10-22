// ============================================================
// KULTURA — Route Handler: /api/account
// GET:    qué se pierde y qué cambia de dueño si se borra la cuenta (modal)
// DELETE: borra la cuenta, o la programa para dentro de 7 días (ROJO-7)
// PATCH:  { cancel_deletion: true } cancela un borrado programado
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { DEMO_READ_ONLY_ERROR, isDemoUser } from '@/lib/demo'
import {
  accountGraceEnabled,
  cancelDeletion,
  deleteAccountNow,
  readAccountState,
  readDeletionPreview,
  scheduleDeletion,
} from '@/app/api/settings/account-state'
import { ACCOUNT_GRACE_DAYS, purgeDate } from '@/app/api/settings/identity'

const log = createLogger('api/account')

type ServerClient = ReturnType<typeof createClient>

async function currentUser(supabase: ServerClient) {
  const { data: { user }, error } = await supabase.auth.getUser()
  return error ? null : user
}

/** Recuento con `head: true` (sin traer filas); `0` si falla. */
async function count(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: n, error } = await query
  return error ? 0 : (n ?? 0)
}

/**
 * GET /api/account — resumen para el modal de borrado: cuántos títulos,
 * listas, mensajes y amistades se borran, qué grupos y listas colaborativas
 * pasan a otra persona (y a quién) y si habrá días de gracia.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const user = await currentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const [library, lists, messages, friends, preview, account] = await Promise.all([
    count(admin.from('user_media').select('id', { count: 'exact', head: true }).eq('user_id', user.id)),
    count(admin.from('lists').select('id', { count: 'exact', head: true }).eq('owner_id', user.id)),
    count(admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', user.id)),
    count(
      admin
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    ),
    readDeletionPreview(admin, user.id),
    readAccountState(supabase, user.id),
  ])

  const graceDays = accountGraceEnabled() && account.migrated ? ACCOUNT_GRACE_DAYS : 0
  return NextResponse.json({
    library,
    lists,
    messages,
    friends,
    // `null`: la migración aún no está y no se sabe a quién pasarían.
    groups: preview?.groups ?? null,
    sharedLists: preview?.lists ?? null,
    graceDays,
    deletionRequestedAt: account.state?.deletion_requested_at ?? null,
  })
}

/**
 * DELETE /api/account — con `ACCOUNT_GRACE=1` y la migración de F-12, deja la
 * cuenta programada para borrarse en 7 días (el cron diario la borra; entrar y
 * cancelar en Ajustes la salva). Si no, la borra ya: primero traspasa grupos y
 * listas colaborativas a otra persona y después el usuario de Auth, que se
 * lleva en cascada el resto (`list_items.added_by` y `suggestions.user_id`
 * quedan a NULL, conservando lo que aportó a listas ajenas sin su nombre).
 */
export async function DELETE(): Promise<NextResponse> {
  const supabase = createClient()
  const user = await currentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // El middleware ya lo corta; aquí también, porque esto usa el cliente admin.
  if (isDemoUser(user)) return NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 })

  const rl = checkRateLimit(`${user.id}:account_delete`, LIMITS.account_delete)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const admin = createAdminClient()

  if (accountGraceEnabled()) {
    const requestedAt = await scheduleDeletion(admin, user.id)
    if (requestedAt) {
      return NextResponse.json({
        ok: true,
        scheduled: true,
        purgeAt: purgeDate(requestedAt).toISOString(),
      })
    }
    // Sin la tabla no hay quien cumpla el borrado programado: se borra ya.
    log.warn('ACCOUNT_GRACE activo pero account_state no responde: borrado inmediato')
  }

  const result = await deleteAccountNow(admin, user.id)
  if (!result.ok) {
    log.error(`Failed to delete account (${result.step}) · ${result.message}`, { userId: user.id })
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, scheduled: false, transferred: result.transferred })
}

/** PATCH /api/account — `{ cancel_deletion: true }`. */
export async function PATCH(req: Request): Promise<NextResponse> {
  const supabase = createClient()
  const user = await currentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (isDemoUser(user)) return NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { cancel_deletion?: unknown } | null
  if (body?.cancel_deletion !== true) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const ok = await cancelDeletion(createAdminClient(), user.id)
  if (!ok) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
