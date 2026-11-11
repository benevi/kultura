// ============================================================
// KULTURA — Servicio de /api/account (saneamiento 6.3)
// Resumen del borrado, borrar (o programarlo, ROJO-7) y cancelarlo. Sin HTTP:
// devuelve `ServiceResult` y la ruta lo convierte en respuesta.
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { isDemoUser } from '@/lib/demo'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import { ACCOUNT_ERRORS } from '@/lib/account/errors'
import type { accountDeleteResultSchema, deletionSummarySchema } from '@/lib/api/contracts/account'
import {
  accountGraceEnabled,
  cancelDeletion,
  deleteAccountNow,
  readAccountState,
  readDeletionPreview,
  scheduleDeletion,
} from '@/lib/account/account-state'
import { ACCOUNT_GRACE_DAYS, purgeDate } from '@/lib/account/identity'
import { verifyDeletionIdentity } from '@/lib/account/reauth'

const log = createLogger('account/service')

export type DeletionSummary = z.infer<typeof deletionSummarySchema>
export type AccountDeleteResult = z.infer<typeof accountDeleteResultSchema>

/** La demo no escribe (el middleware ya lo corta; aquí también, por el cliente admin). */
export function demoForbidden<T>(user: User): ServiceResult<T> | null {
  return isDemoUser(user) ? failure('forbidden', { message: ACCOUNT_ERRORS.demoReadOnly }) : null
}

/** Recuento con `head: true` (sin traer filas); `0` si falla. */
async function count(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: n, error } = await query
  return error ? 0 : (n ?? 0)
}

/**
 * Resumen para el modal de borrado: cuántos títulos, listas, mensajes y
 * amistades se borran, qué grupos y listas colaborativas pasan a otra persona
 * (y a quién) y si habrá días de gracia.
 */
export async function getDeletionSummary(supabase: SupabaseClient, userId: string): Promise<ServiceResult<DeletionSummary>> {
  const admin = createAdminClient()
  const [library, lists, messages, friends, preview, account] = await Promise.all([
    count(admin.from('user_media').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    count(admin.from('lists').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
    count(admin.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId)),
    count(
      admin
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    ),
    readDeletionPreview(admin, userId),
    readAccountState(supabase, userId),
  ])

  return success({
    library,
    lists,
    messages,
    friends,
    groups: preview?.groups ?? null,
    sharedLists: preview?.lists ?? null,
    graceDays: accountGraceEnabled() && account.migrated ? ACCOUNT_GRACE_DAYS : 0,
    deletionRequestedAt: account.state?.deletion_requested_at ?? null,
  })
}

/**
 * Borra la cuenta tras reautenticar: contraseña si la tiene; si no (solo
 * Google), un inicio de sesión de hace menos de 10 minutos.
 *
 * Con `ACCOUNT_GRACE=1`, la programa para dentro de 7 días (el cron diario la
 * borra; entrar y cancelar la salva). Si no se puede programar, `unavailable`
 * y nada se borra. Sin la bandera, la borra ya: primero traspasa grupos y
 * listas colaborativas y después el usuario de Auth, que se lleva en cascada
 * el resto.
 */
export async function deleteAccount(user: User, password: string | undefined): Promise<ServiceResult<AccountDeleteResult>> {
  const demo = demoForbidden<AccountDeleteResult>(user)
  if (demo) return demo

  const identity = await verifyDeletionIdentity(user, password ? password : null)
  if (!identity.ok) {
    return identity.code === 'password_required'
      ? failure('invalid_input', { field: 'password', message: ACCOUNT_ERRORS.passwordRequired })
      : failure('forbidden', { message: identity.code })
  }

  const admin = createAdminClient()
  if (accountGraceEnabled()) {
    const requestedAt = await scheduleDeletion(admin, user.id)
    if (requestedAt) return success({ scheduled: true, purgeAt: purgeDate(requestedAt).toISOString() })
    // El modal ha prometido días de gracia: mejor un error y reintentar que
    // un borrado inmediato e irreversible.
    log.error('ACCOUNT_GRACE activo pero no se pudo programar el borrado: no se borra', { userId: user.id })
    return failure('unavailable', { message: ACCOUNT_ERRORS.deletionNotScheduled })
  }

  const result = await deleteAccountNow(admin, user.id)
  if (!result.ok) {
    log.error(`Failed to delete account (${result.step}) · ${result.message}`, { userId: user.id })
    return failure('internal', { message: 'Failed to delete account' })
  }
  return success({ scheduled: false, transferred: result.transferred })
}

/** Cancela un borrado programado. */
export async function cancelAccountDeletion(user: User): Promise<ServiceResult<null>> {
  const demo = demoForbidden<null>(user)
  if (demo) return demo
  const ok = await cancelDeletion(createAdminClient(), user.id)
  return ok ? success(null) : failure('internal', { message: 'Failed to update' })
}
