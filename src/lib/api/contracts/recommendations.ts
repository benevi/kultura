// ============================================================
// KULTURA — Contrato de /api/recommendations (saneamiento 9)
//
// /api/recommendations   POST: recomendar un título a una amistad aceptada.
//                 201 `data: { recommendationId }`. Errores: `invalid_input`
//                 (con `field`), `not_found` (el destinatario no existe),
//                 `forbidden` con `RECOMMENDATION_ERRORS.notFriends`,
//                 `provider_unavailable` y `rate_limited`.
// ============================================================

import { z } from 'zod'

export const RECOMMENDATION_ERRORS = {
  /** `forbidden`: solo a amistades aceptadas (y sin bloqueo). */
  notFriends: 'not_friends',
  /** `invalid_input` (field `toUserId`): no se recomienda a uno mismo. */
  self: 'cannot_recommend_self',
} as const

/** Tope de `message` (la columna es TEXT sin restricción). */
export const RECOMMENDATION_MESSAGE_MAX = 500

/** POST /api/recommendations. `mediaCache` se acepta y se ignora (SEG-2). */
export const recommendationCreateSchema = z.object({
  toUserId: z.string().min(1),
  mediaId: z.string().regex(/^[a-z]+_.+$/, 'mediaId must follow the format "{type}_{externalId}"'),
  message: z.string().max(RECOMMENDATION_MESSAGE_MAX).nullish(),
  mediaCache: z.unknown().optional(),
})

export type RecommendationCreateInput = z.infer<typeof recommendationCreateSchema>

export interface RecommendationCreated {
  recommendationId: string
}
