// ============================================================
// KULTURA — Route Handler: /api/account
// GET:    qué se pierde y qué cambia de dueño si se borra la cuenta (modal)
// DELETE: borra la cuenta, o la programa para dentro de 7 días (ROJO-7)
// PATCH:  { cancel_deletion: true } cancela un borrado programado
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { accountDeleteSchema, accountPatchSchema } from '@/lib/api/contracts/account'
import { cancelAccountDeletion, deleteAccount, getDeletionSummary } from '@/lib/account/service'

/** GET /api/account — resumen para el modal de borrado. */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return respond(await getDeletionSummary(auth.supabase, auth.user.id))
}

/**
 * DELETE /api/account — body `{ password? }`. El límite va antes de la
 * reautenticación: frena también adivinar la contraseña.
 */
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'account_delete', limit: LIMITS.account_delete, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, accountDeleteSchema)
  if (!body.ok) return body.response
  return respond(await deleteAccount(auth.user, body.value.password))
}

/** PATCH /api/account — `{ cancel_deletion: true }`. */
export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await parseBody(request, accountPatchSchema)
  if (!body.ok) return body.response
  return respond(await cancelAccountDeletion(auth.user))
}
