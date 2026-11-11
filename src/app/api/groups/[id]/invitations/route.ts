// ============================================================
// KULTURA — Route Handler: /api/groups/[id]/invitations
// GET:  amigos que el dueño puede invitar
// POST: { inviteeId } → invitar a un amigo (solo el dueño; 201)
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { groupInviteSchema } from '@/lib/api/contracts/groups'
import { uuidSchema } from '@/lib/api/contracts/common'
import { inviteFriend, listInvitableFriends } from '@/lib/groups/service'

interface Params {
  params: Promise<{ id: string }>
}

const notFound = () => apiError('not_found', { message: 'Group not found' })

/** GET /api/groups/[id]/invitations */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  return respond(await listInvitableFriends(auth.user.id, id))
}

/** POST /api/groups/[id]/invitations */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // Mismo cupo que crear grupos (5/hora), como antes.
  const limited = await rateLimit(request, { key: 'groups', limit: LIMITS.groups, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()
  const body = await parseBody(request, groupInviteSchema)
  if (!body.ok) return body.response

  return respond(await inviteFriend(auth.supabase, auth.user.id, id, body.value.inviteeId), { status: 201 })
}
