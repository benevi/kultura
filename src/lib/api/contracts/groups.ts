// ============================================================
// KULTURA — Contrato de /api/groups (saneamiento 6.1 y 7.2)
//
// /api/groups                                 GET (mis grupos) · POST (crear, 201)
// /api/groups/discover                        GET (?q, scope, size, limit, offset)
// /api/groups/[id]/join                       POST (entrar 201 / salir 200)
// /api/groups/[id]/invitations                GET (amigos invitables) · POST (invitar, 201)
// /api/groups/invitations/[invitationId]      PATCH (aceptar) · DELETE (rechazar)
// /api/groups/[id]/members/[userId]           DELETE (expulsar, F-11)
// /api/groups/[id]/posts                      POST (publicar, 201)
// /api/groups/[id]/posts/[postId]             DELETE (borrar)
// ============================================================

import { z } from 'zod'
import { uuidSchema } from '@/lib/api/contracts/common'
import { isValidAvatarIcon } from '@/components/icons/avatars'
import { GROUP_ERRORS } from '@/lib/groups/errors'

export { GROUP_ERRORS }

/** El formulario corta en 1000; la base admite hasta 2000. */
export const GROUP_POST_MAX = 1000

/** POST /api/groups. */
export const groupCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  cover_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_public: z.boolean().optional().default(true),
  // E-AVATAR-ICONS: mismo catálogo que los avatares; null/ausente → la inicial.
  icon: z.string().refine(isValidAvatarIcon, { message: 'invalid_icon' }).nullable().optional(),
})

/** GET /api/groups/discover. */
export const discoverQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  scope: z.enum(['all', 'joined', 'unjoined']).default('all'),
  size: z.enum(['all', 'small', 'medium', 'large']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/** POST /api/groups/[id]/invitations. */
export const groupInviteSchema = z.object({ inviteeId: uuidSchema })

/** POST /api/groups/[id]/posts. Se guarda recortado; vacío no vale. */
export const groupPostSchema = z.object({
  content: z.string().max(GROUP_POST_MAX).trim().min(1, 'Empty post'),
})

// ── Respuestas ───────────────────────────────────────────────────────────────

export const groupSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  coverColor: z.string(),
  icon: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  memberRole: z.string().optional(),
})

/** `data` de GET /api/groups. */
export const groupsResultSchema = z.array(groupSchema)

/** `data` de POST /api/groups (201): el grupo, con `memberRole: 'owner'`. */
export const groupCreateResultSchema = groupSchema

/** `data` de GET /api/groups/discover. */
export const discoverResultSchema = z.array(
  z.object({
    id: z.string(),
    ownerId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    coverColor: z.string(),
    icon: z.string().nullable(),
    createdAt: z.string(),
    memberCount: z.number().int().min(0),
    isMember: z.boolean(),
  })
)

/** `data` de POST /api/groups/[id]/join. */
export const joinResultSchema = z.object({ joined: z.boolean() })

/** `data` de GET /api/groups/[id]/invitations. */
export const invitableFriendsSchema = z.array(
  z.object({
    id: z.string(),
    username: z.string(),
    avatarColor: z.string().nullable(),
    avatarInitials: z.string().nullable(),
  })
)

/** `data` de POST /api/groups/[id]/invitations (201). */
export const invitationSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  inviterId: z.string(),
  inviteeId: z.string(),
  status: z.enum(['pending', 'accepted']),
  createdAt: z.string(),
})
