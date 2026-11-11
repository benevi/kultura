// ============================================================
// KULTURA — Route Handler: /api/chat
// GET:  mis conversaciones (la más reciente primero)
// POST: { targetUserId } → abrir (o recuperar) la conversación con un amigo (201)
// El contador de no leídas: GET /api/chat/unread.
//
// La lógica está en `lib/chat/service.ts`; el contrato en
// `lib/api/contracts/chat.ts`. Respuesta: `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 6 y 7).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { chatCreateSchema } from '@/lib/api/contracts/chat'
import { listConversations, openConversation } from '@/lib/chat/service'

/** GET /api/chat */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return respond(await listConversations(auth.supabase, auth.user.id))
}

/** POST /api/chat */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'chat_create', limit: LIMITS.chat_create, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, chatCreateSchema)
  if (!body.ok) return body.response

  return respond(await openConversation(auth.supabase, auth.user.id, body.value.targetUserId), { status: 201 })
}
