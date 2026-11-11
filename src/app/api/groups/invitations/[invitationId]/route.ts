// ============================================================
// KULTURA — Route Handler: /api/groups/invitations/[invitationId]
// PATCH:  aceptar (solo el invitado); marca leída la notificación
// DELETE: rechazar (el invitado) o retirar (el que invita); borra la notificación
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { acceptInvitation, rejectInvitation } from '@/lib/groups/service'

interface Params {
  params: Promise<{ invitationId: string }>
}

type Action = typeof acceptInvitation

/** Sesión, cupo e id válido; después, la acción. */
async function handle(request: Request, params: Params['params'], action: Action) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, {
    key: 'group_invitations',
    limit: LIMITS.group_invitations,
    userId: auth.user.id,
  })
  if (limited) return limited
  const { invitationId } = await params
  if (!uuidSchema.safeParse(invitationId).success) {
    return apiError('not_found', { message: 'Invitation not found' })
  }
  return respond(await action(auth.supabase, auth.user.id, invitationId))
}

/** PATCH /api/groups/invitations/[invitationId] */
export function PATCH(request: Request, { params }: Params) {
  return handle(request, params, acceptInvitation)
}

/** DELETE /api/groups/invitations/[invitationId] */
export function DELETE(request: Request, { params }: Params) {
  return handle(request, params, rejectInvitation)
}
