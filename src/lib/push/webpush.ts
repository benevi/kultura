// ============================================================
// KULTURA — Web Push sin dependencias (F-33) · solo servidor
//
// Implementación propia con Web Crypto (`crypto.subtle`, Node ≥ 20) en lugar
// de la librería `web-push`: cero dependencias nuevas (ni `jws`, ni
// `asn1.js`, ni `https-proxy-agent`) y ~150 líneas que no llegan nunca al
// bundle del navegador (`server-only`).
//   - Cifrado del contenido: RFC 8291 (Message Encryption for Web Push) con
//     `Content-Encoding: aes128gcm` (RFC 8188), un solo registro.
//     Comprobado byte a byte con el ejemplo del §5 del RFC
//     (tests/unit/push/webpush.test.ts).
//   - Identificación del servidor: RFC 8292 (VAPID), JWT ES256 con `aud` =
//     origen del servicio push, `exp` ≤ 24 h y `sub` = contacto.
// ============================================================

import 'server-only'
import { fromBase64Url, toBase64Url } from './base64url'
import { isAllowedPushEndpoint } from './endpoint'
import type { PushConfig } from './config'

const subtle = globalThis.crypto.subtle
const encoder = new TextEncoder()

/** Tamaño del registro (RFC 8188) y máximo de texto que cabe en 4096 bytes de cuerpo. */
const RECORD_SIZE = 4096
const HEADER_LENGTH = 16 + 4 + 1 + 65
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - HEADER_LENGTH - 16 - 1

function bytes(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(length)
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = bytes(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** JWK de una clave P-256 a partir de la pública sin comprimir (65 bytes) y, si se da, la privada (32). */
function p256Jwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicKey.subarray(1, 33)),
    y: toBase64Url(publicKey.subarray(33, 65)),
    ...(privateKey ? { d: toBase64Url(privateKey) } : {}),
    ext: true,
  }
}

export interface PushKeys {
  /** Clave pública del navegador (base64url, 65 bytes). */
  p256dh: string
  /** Secreto de autenticación del navegador (base64url, 16 bytes). */
  auth: string
}

/** Solo para los tests: fijar la sal y el par efímero para reproducir el ejemplo del RFC. */
export interface EncryptOverrides {
  salt?: Uint8Array<ArrayBuffer>
  senderPublicKey?: Uint8Array<ArrayBuffer>
  senderPrivateKey?: Uint8Array<ArrayBuffer>
}

/** Cuerpo `aes128gcm` listo para mandar (RFC 8291 §3.4 y §4). */
export async function encryptPayload(
  plaintext: Uint8Array<ArrayBuffer>,
  keys: PushKeys,
  overrides: EncryptOverrides = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error('push payload too large')
  const uaPublic = fromBase64Url(keys.p256dh)
  const authSecret = fromBase64Url(keys.auth)
  if (!uaPublic || uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('invalid p256dh')
  if (!authSecret || authSecret.length !== 16) throw new Error('invalid auth secret')

  let asPublic: Uint8Array<ArrayBuffer>
  let asPrivate: CryptoKey
  if (overrides.senderPublicKey && overrides.senderPrivateKey) {
    asPublic = overrides.senderPublicKey
    asPrivate = await subtle.importKey(
      'jwk',
      p256Jwk(asPublic, overrides.senderPrivateKey),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
  } else {
    const pair = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    asPublic = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
    asPrivate = pair.privateKey
  }

  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256))

  // §3.4: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concat(encoder.encode('WebPush: info\u0000'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  const salt = overrides.salt ?? crypto.getRandomValues(bytes(16))
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\u0000'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\u0000'), 12)

  // Un único registro, el último: delimitador 0x02 y sin relleno.
  const record = concat(plaintext, Uint8Array.of(2))
  const aesKey = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record))

  const header = bytes(HEADER_LENGTH)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = 65
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** Validez del JWT de VAPID (RFC 8292 pide ≤ 24 h). */
const VAPID_TTL_SECONDS = 12 * 60 * 60
const jwtCache = new Map<string, { token: string; exp: number }>()

/** Cabecera `Authorization: vapid t=…, k=…` para el origen del endpoint. */
export async function vapidAuthorization(endpoint: string, config: PushConfig, now = Date.now()): Promise<string> {
  const audience = new URL(endpoint).origin
  const nowSeconds = Math.floor(now / 1000)
  const cacheKey = `${config.publicKey}|${config.subject}|${audience}`
  const cached = jwtCache.get(cacheKey)
  // Se reutiliza mientras le quede más de una hora.
  if (cached && cached.exp - nowSeconds > 3600) return `vapid t=${cached.token}, k=${config.publicKey}`

  const exp = nowSeconds + VAPID_TTL_SECONDS
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toBase64Url(encoder.encode(JSON.stringify({ aud: audience, exp, sub: config.subject })))
  const unsigned = `${header}.${claims}`
  const privateBytes = fromBase64Url(config.privateKey)
  if (!privateBytes) throw new Error('invalid VAPID private key')
  const key = await subtle.importKey(
    'jwk',
    p256Jwk(config.publicKeyBytes, privateBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // Web Crypto firma en formato IEEE P1363 (r || s, 64 bytes), el que pide JWS.
  const signature = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)))
  const token = `${unsigned}.${toBase64Url(signature)}`
  jwtCache.set(cacheKey, { token, exp })
  return `vapid t=${token}, k=${config.publicKey}`
}

export interface PushMessage {
  endpoint: string
  keys: PushKeys
  /** JSON que leerá el service worker (`public/sw.js`, evento `push`). */
  payload: unknown
  /** Segundos que el servicio guarda el aviso si el dispositivo está apagado. */
  ttl?: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
  /** Avisos pendientes con el mismo `topic` se sustituyen (≤ 32 caracteres base64url). */
  topic?: string
}

export type PushOutcome =
  /** Entregado al servicio push. */
  | { status: 'sent'; httpStatus: number }
  /** La suscripción ya no existe (404/410): hay que borrarla. */
  | { status: 'gone'; httpStatus: number }
  /** Error que puede ser pasajero (429, 5xx, red) o de configuración (400, 401, 403, 413). */
  | { status: 'failed'; httpStatus: number | null; reason: string }

export const PUSH_TIMEOUT_MS = 5000

export async function sendPush(
  message: PushMessage,
  config: PushConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PushOutcome> {
  // Otra vez la lista blanca: la fila pudo escribirse sin pasar por la API.
  if (!isAllowedPushEndpoint(message.endpoint)) return { status: 'failed', httpStatus: null, reason: 'endpoint_not_allowed' }
  let body: Uint8Array<ArrayBuffer>
  try {
    body = await encryptPayload(encoder.encode(JSON.stringify(message.payload)), message.keys)
  } catch (e) {
    return { status: 'failed', httpStatus: null, reason: e instanceof Error ? e.message : 'encrypt_failed' }
  }
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(message.endpoint, config),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.floor(message.ttl ?? 24 * 60 * 60))),
    Urgency: message.urgency ?? 'normal',
  }
  if (message.topic && /^[A-Za-z0-9_-]{1,32}$/.test(message.topic)) headers.Topic = message.topic
  try {
    const response = await fetchImpl(message.endpoint, {
      method: 'POST',
      headers,
      body,
      // Una redirección podría llevar a cualquier sitio: no se sigue.
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    })
    if (response.status >= 200 && response.status < 300) return { status: 'sent', httpStatus: response.status }
    if (response.status === 404 || response.status === 410) return { status: 'gone', httpStatus: response.status }
    return { status: 'failed', httpStatus: response.status, reason: `http_${response.status}` }
  } catch (e) {
    return { status: 'failed', httpStatus: null, reason: e instanceof Error ? e.name : 'network' }
  }
}
