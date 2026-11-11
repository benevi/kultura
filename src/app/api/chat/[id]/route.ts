// ============================================================
// KULTURA — Route Handler: /api/chat/[id]
// GET:    los últimos mensajes (?before=<created_at> para los anteriores)
// POST:   { content } → enviar (201)
// DELETE: salir de la conversación (F-11, con MODERATION_V2)
// Un id que no es uuid es una conversación que no existe (`not_found`).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, parseBody, parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { messageSendSchema, messagesQuerySchema } from '@/lib/api/contracts/chat'
import { uuidSchema } from '@/lib/api/contracts/common'
import { leaveConversation, readMessages, sendMessage } from '@/lib/chat/service'

interface Params {
  params: Promise<{ id: string }>
}

const notFound = () => apiError('not_found', { message: 'Conversation not found' })

/** GET /api/chat/[id] */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'chat_read', limit: LIMITS.chat_read, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()
  const query = parseQuery(request, messagesQuerySchema)
  if (!query.ok) return query.response

  return respond(await readMessages(auth.supabase, auth.user.id, id, query.value.before))
}

/** POST /api/chat/[id] */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'chat_message', limit: LIMITS.chat_message, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()
  const body = await parseBody(request, messageSendSchema)
  if (!body.ok) return body.response

  return respond(await sendMessage(auth.supabase, auth.user.id, id, body.value.content), { status: 201 })
}

/** DELETE /api/chat/[id] */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'chat_leave', limit: LIMITS.chat_create, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return notFound()

  return respond(await leaveConversation(auth.supabase, auth.user.id, id))
}
