// ============================================================
// KULTURA — Contrato de /api/friends (saneamiento 6.1 y 7.2)
//
// /api/friends          GET (mis amigos) · POST (pedir) · PATCH (aceptar o
//                       rechazar) · DELETE (quitar)
// /api/friends/blocks   GET (¿he bloqueado a…? o la lista) · POST (bloquear)
//                       · DELETE (desbloquear) — F-11, con MODERATION_V2
// ============================================================

import { z } from 'zod'
import { uuidSchema } from '@/lib/api/contracts/common'

/** POST /api/friends. */
export const friendRequestSchema = z.object({ receiverId: uuidSchema })

/** PATCH /api/friends: solo quien la recibe. */
export const friendRespondSchema = z.object({
  friendshipId: uuidSchema,
  action: z.enum(['accept', 'decline']),
})

/** DELETE /api/friends: cualquiera de los dos. */
export const friendDeleteSchema = z.object({ friendshipId: uuidSchema })

/**
 * GET /api/friends/blocks?userId=…. Un id que no es uuid (o el propio) no da
 * error: responde «no bloqueado», como antes.
 */
export const blocksQuerySchema = z.object({ userId: z.string().max(64).optional() })

/** POST y DELETE /api/friends/blocks. */
export const blockBodySchema = z.object({ userId: uuidSchema })

// ── Respuestas ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar_color: z.string().nullable(),
  avatar_initials: z.string().nullable(),
})

/** `data` de GET /api/friends: el perfil del otro en cada amistad aceptada. */
export const friendsResultSchema = z.array(z.object({ friendshipId: z.string(), user: profileSchema }))

export const friendshipSchema = z.object({
  id: z.string(),
  requester_id: z.string(),
  receiver_id: z.string(),
  status: z.string(),
  created_at: z.string(),
})

/** `data` de POST /api/friends (201). */
export const friendRequestResultSchema = friendshipSchema

/** `data` de PATCH /api/friends: la amistad aceptada, o `null` al rechazar. */
export const friendRespondResultSchema = friendshipSchema.nullable()

/** `data` de GET /api/friends/blocks?userId=…. */
export const blockStateSchema = z.object({ enabled: z.boolean(), blocked: z.boolean() })

/** `data` de GET /api/friends/blocks. */
export const blockedUsersSchema = z.object({
  enabled: z.boolean(),
  users: z.array(
    z.object({ id: z.string(), username: z.string(), avatarColor: z.string(), avatarInitials: z.string() })
  ),
})
