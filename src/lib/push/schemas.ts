// ============================================================
// KULTURA — Validación de lo que llega a /api/push/* (F-33)
// ============================================================

import { z } from 'zod'
import { fromBase64Url, toBase64Url } from './base64url'
import { isAllowedPushEndpoint, MAX_ENDPOINT_LENGTH } from './endpoint'

export const PUSH_LOCALES = ['es', 'en'] as const
export type PushLocale = (typeof PUSH_LOCALES)[number]

export const endpointSchema = z
  .string()
  .max(MAX_ENDPOINT_LENGTH)
  .refine((value) => isAllowedPushEndpoint(value), { message: 'endpoint_not_allowed' })

/** Clave en base64url (se acepta base64 con relleno) normalizada a base64url sin relleno. */
function keySchema(length: number, firstByte?: number) {
  return z
    .string()
    .max(200)
    .transform((value, ctx) => {
      const decoded = fromBase64Url(value)
      if (!decoded || decoded.length !== length || (firstByte !== undefined && decoded[0] !== firstByte)) {
        ctx.addIssue({ code: 'custom', message: 'invalid_key' })
        return z.NEVER
      }
      return toBase64Url(decoded)
    })
}

export const subscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    /** Punto P-256 sin comprimir: 65 bytes que empiezan por 0x04. */
    p256dh: keySchema(65, 4),
    auth: keySchema(16),
  }),
  /** `PushSubscription.expirationTime` (ms desde 1970) o null. */
  expirationTime: z.number().int().positive().nullable().optional(),
  locale: z.enum(PUSH_LOCALES).optional(),
  /** `pushsubscriptionchange`: endpoint anterior del mismo navegador, que se sustituye. */
  replaces: endpointSchema.optional(),
})
export type SubscribeBody = z.infer<typeof subscribeSchema>

export const unsubscribeSchema = z.union([
  z.object({ endpoint: endpointSchema }),
  z.object({ all: z.literal(true) }),
])

export const PUSH_EVENT_KINDS = ['message', 'notification', 'friend_request', 'friend_accepted'] as const
export type PushEventKind = (typeof PUSH_EVENT_KINDS)[number]

export const dispatchSchema = z.object({
  kind: z.enum(PUSH_EVENT_KINDS),
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
})
export type DispatchBody = z.infer<typeof dispatchSchema>
