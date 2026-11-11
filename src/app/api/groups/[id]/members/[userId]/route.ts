// ============================================================
// KULTURA — Route Handler: /api/groups/[id]/members/[userId] (F-11)
// DELETE: el dueño expulsa a un miembro (y le veta). Con MODERATION_V2.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { removeMember } from '@/lib/groups/service'

interface Params {
  params: Promise<{ id: string; userId: string }>
}

/** DELETE /api/groups/[id]/members/[userId] */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'group_kick', limit: LIMITS.groups_join, userId: auth.user.id })
  if (limited) return limited
  const { id, userId } = await params
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(userId).success) {
    return apiError('not_found', { message: 'Member not found' })
  }

  return respond(await removeMember(auth.supabase, auth.user.id, id, userId))
}
