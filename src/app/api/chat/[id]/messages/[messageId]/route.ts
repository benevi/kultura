// ============================================================
// KULTURA — Route Handler: /api/chat/[id]/messages/[messageId] (F-11)
// DELETE: borrar un mensaje propio (con MODERATION_V2; la política
// "Senders can delete own messages" llega con la migración de moderación).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { deleteOwnMessage } from '@/lib/chat/service'

interface Params {
  params: Promise<{ id: string; messageId: string }>
}

/** DELETE /api/chat/[id]/messages/[messageId] */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'chat_delete', limit: LIMITS.chat_read, userId: auth.user.id })
  if (limited) return limited
  const { id, messageId } = await params
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(messageId).success) {
    return apiError('not_found', { message: 'Message not found' })
  }

  return respond(await deleteOwnMessage(auth.supabase, auth.user.id, id, messageId))
}
