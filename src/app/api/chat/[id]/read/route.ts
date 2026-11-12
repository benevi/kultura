// ============================================================
// KULTURA — Route Handler: /api/chat/[id]/read (saneamiento 9.2)
// POST: marca la conversación como leída (`last_read_at` = ahora).
// Un id que no es uuid es una conversación que no existe (`not_found`).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { markConversationRead } from '@/lib/chat/service'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/chat/[id]/read */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // Se llama al abrir el chat y con cada mensaje recibido estando abierto: el
  // mismo límite que leer mensajes (60/min).
  const limited = await rateLimit(request, { key: 'chat_mark_read', limit: LIMITS.chat_read, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return apiError('not_found', { message: 'Conversation not found' })
  return respond(await markConversationRead(auth.supabase, auth.user.id, id))
}
