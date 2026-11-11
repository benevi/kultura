// ============================================================
// KULTURA — Contrato de /api/chat (saneamiento 6.1 y 7.2)
//
// /api/chat                               GET (mis conversaciones) · POST (abrir con un amigo)
// /api/chat/unread                        GET (cuántas tienen algo sin leer; antes ?countOnly=1)
// /api/chat/[id]                          GET (mensajes, ?before=) · POST (enviar) · DELETE (salir, F-11)
// /api/chat/[id]/messages/[messageId]     DELETE (borrar uno propio, F-11)
// ============================================================

import { z } from 'zod'
import { uuidSchema } from '@/lib/api/contracts/common'
import { CHAT_ERRORS } from '@/lib/chat/errors'

/** Tope de un mensaje (messages.content es TEXT sin constraint). */
export const CHAT_MESSAGE_MAX = 2000

export { CHAT_ERRORS }

/** POST /api/chat. */
export const chatCreateSchema = z.object({ targetUserId: uuidSchema })

/** GET /api/chat/[id]?before=<created_at> pide la página anterior. */
export const messagesQuerySchema = z.object({
  before: z
    .string()
    .max(64)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'before must be a date')
    .optional(),
})

/** POST /api/chat/[id]. Se guarda recortado; vacío no vale. */
export const messageSendSchema = z.object({
  content: z.string().max(CHAT_MESSAGE_MAX).trim().min(1, 'Empty message'),
})

// ── Respuestas ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar_color: z.string().nullable(),
  avatar_initials: z.string().nullable(),
})

/** `data` de GET /api/chat. */
export const conversationsResultSchema = z.array(
  z.object({
    id: z.string(),
    lastMessageAt: z.string().nullable(),
    otherUser: profileSchema.nullable(),
    lastMessage: z.object({ content: z.string(), isMine: z.boolean() }).nullable(),
    unread: z.boolean(),
  })
)

/** `data` de GET /api/chat/unread. */
export const unreadResultSchema = z.object({ count: z.number().int().min(0) })

/** `data` de POST /api/chat (201). */
export const chatCreateResultSchema = z.object({ conversationId: z.string() })

export const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  sender_id: z.string().nullable(),
  created_at: z.string(),
})

/** `data` de GET /api/chat/[id]: en orden cronológico. */
export const messagesPageSchema = z.object({
  messages: z.array(
    messageSchema.extend({
      users: z
        .object({ username: z.string(), avatar_color: z.string().nullable(), avatar_initials: z.string().nullable() })
        .nullable()
        .optional(),
    })
  ),
  hasMore: z.boolean(),
  currentUserId: z.string(),
})

/** `data` de POST /api/chat/[id] (201). */
export const messageSendResultSchema = messageSchema
