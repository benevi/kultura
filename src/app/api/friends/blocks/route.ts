// ============================================================
// KULTURA — Route Handler: /api/friends/blocks (F-11, D-13)
// GET  ?userId=…   → { enabled, blocked } (¿he bloqueado a este usuario?)
// GET              → { enabled, users }   (a quién he bloqueado)
// POST   { userId } → bloquear (la base borra la amistad y las invitaciones)
// DELETE { userId } → desbloquear (la amistad no vuelve: hay que pedirla)
// `enabled: false` sin MODERATION_V2: la UI no enseña nada; POST y DELETE
// responden `not_found` (`moderation_disabled`).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { blockBodySchema, blocksQuerySchema } from '@/lib/api/contracts/friends'
import { block, listBlocked, readBlockState, unblock } from '@/lib/friends/service'

/** GET /api/friends/blocks */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const query = parseQuery(request, blocksQuerySchema)
  if (!query.ok) return query.response

  const { userId } = query.value
  if (userId) return respond(await readBlockState(auth.user.id, userId))
  return respond(await listBlocked(auth.user.id))
}

async function mutate(request: Request, action: typeof block | typeof unblock) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'blocks', limit: LIMITS.friends, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, blockBodySchema)
  if (!body.ok) return body.response

  return respond(await action(auth.supabase, auth.user.id, body.value.userId))
}

/** POST /api/friends/blocks */
export function POST(request: Request) {
  return mutate(request, block)
}

/** DELETE /api/friends/blocks */
export function DELETE(request: Request) {
  return mutate(request, unblock)
}
