// ============================================================
// KULTURA — Lista blanca de servicios push (anti-SSRF, MOV-10)
//
// El servidor hace un POST a la URL (`endpoint`) que da el navegador al
// suscribirse. Sin lista blanca, cualquiera con cuenta podría guardar
// `https://169.254.169.254/…` o una URL interna y hacer que el servidor la
// llame. Solo se aceptan los servicios de los navegadores que existen:
//   - FCM (Chrome, Edge de Android, Opera, Samsung…):  fcm.googleapis.com
//   - Mozilla autopush (Firefox):          updates.push.services.mozilla.com
//   - Apple (Safari en macOS e iOS/iPadOS 16.4+ con la app instalada):
//     web.push.apple.com (Apple pide permitir *.push.apple.com)
//   - Windows Push Notification Services (Edge en Windows): *.notify.windows.com
// La misma regla está en la base (CHECK `push_subscriptions_endpoint_check`
// de 20261222330001_push.sql) y se vuelve a mirar justo antes de cada envío.
// ============================================================

/** Dominio exacto o cualquier subdominio suyo. */
export const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
] as const

export const MAX_ENDPOINT_LENGTH = 1024

/** Igual que la base: https, host de la lista, sin puerto ni credenciales, ASCII visible. */
export function isAllowedPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_ENDPOINT_LENGTH) return false
  if (!/^https:\/\/[!-~]+$/.test(raw)) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false
  // La URL tal cual tiene que empezar por el host que se comprueba (sin trucos
  // de normalización: mayúsculas, puntos finales, IDN…).
  const prefix = `https://${url.hostname}/`
  if (!raw.startsWith(prefix) || raw.length === prefix.length) return false
  const host = url.hostname
  if (!/^([a-z0-9-]+\.)*[a-z0-9-]+$/.test(host)) return false
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

/**
 * Huella corta de un endpoint (SHA-256, 16 hex). /api/push/status devuelve las
 * huellas de las suscripciones de la persona y el navegador compara la suya:
 * así sabe si ESTE dispositivo está dado de alta sin que viajen los endpoints.
 */
export async function endpointHash(endpoint: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return Array.from(new Uint8Array(digest).subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}
