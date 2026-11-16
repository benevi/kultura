// ============================================================
// KULTURA — Contrato de /api/push/* (F-33, saneamiento 9)
//
// /api/push/status        GET: `data: PushStatus`.
// /api/push/subscribe     POST `subscribeSchema`: `data: null` (201 si es nueva).
// /api/push/unsubscribe   POST `unsubscribeSchema`: `data: PushUnsubscribed`.
// /api/push/dispatch      POST `dispatchSchema` (lo llama la base, sin sesión):
//                         `data: { status, sent, removed, failed }`.
// Los motivos propios van en `error.message` con `PUSH_ERRORS`.
// ============================================================

export { dispatchSchema, subscribeSchema, unsubscribeSchema } from '@/lib/push/schemas'

export const PUSH_ERRORS = {
  /** 503 `unavailable`: PUSH_ENABLED apagado o faltan las claves. */
  disabled: 'push_disabled',
  /** 503 `unavailable`: falta la migración de `push_subscriptions`. */
  notMigrated: 'push_unavailable',
  /** 400 `invalid_input` en `endpoint`: no es de un servicio push conocido. */
  endpointNotAllowed: 'endpoint_not_allowed',
  /** 400 `invalid_input` en `expirationTime`: la suscripción ya caducó. */
  expired: 'subscription_expired',
} as const

export interface PushStatus {
  /** PUSH_ENABLED=1 + par VAPID válido + secreto de envío + tabla creada. */
  enabled: boolean
  publicKey: string | null
  devices: number
  /** Huellas (`endpointHash`) de las suscripciones de la persona. */
  endpointHashes: string[]
}

export interface PushUnsubscribed {
  removed: number
}
