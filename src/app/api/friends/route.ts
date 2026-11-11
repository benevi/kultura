// ============================================================
// KULTURA — Route Handler: /api/friends
// GET:    amigos aceptados (para RecommendModal)
// POST:   { receiverId } → pedir amistad (201)
// PATCH:  { friendshipId, action: 'accept' | 'decline' } → responder
// DELETE: { friendshipId } → quitar la amistad
//
// La lógica está en `lib/friends/service.ts`; el contrato en
// `lib/api/contracts/friends.ts`. Respuesta: `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 6 y 7).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { friendDeleteSchema, friendRequestSchema, friendRespondSchema } from '@/lib/api/contracts/friends'
import { listFriends, removeFriendship, respondRequest, sendRequest } from '@/lib/friends/service'

/** GET /api/friends */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return respond(await listFriends(auth.supabase, auth.user.id))
}

/** POST /api/friends */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'friends', limit: LIMITS.friends, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, friendRequestSchema)
  if (!body.ok) return body.response

  return respond(await sendRequest(auth.supabase, auth.user.id, body.value.receiverId), { status: 201 })
}

/** PATCH /api/friends */
export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'friends', limit: LIMITS.friends, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, friendRespondSchema)
  if (!body.ok) return body.response

  return respond(await respondRequest(auth.supabase, auth.user.id, body.value.friendshipId, body.value.action))
}

/** DELETE /api/friends */
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'friends', limit: LIMITS.friends, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, friendDeleteSchema)
  if (!body.ok) return body.response

  return respond(await removeFriendship(auth.supabase, auth.user.id, body.value.friendshipId))
}
