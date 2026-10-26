// ============================================================
// KULTURA — Enlaces firmados del correo (F-28, CRE-9; RFC 8058)
//
// `v1.<cuerpo>.<firma>`, todo en base64url:
//   cuerpo = "<propósito>:<user_id>:<caduca, segundos Unix>[:<extra>…]"
//   firma  = HMAC-SHA256(EMAIL_TOKEN_SECRET, "v1." + cuerpo) truncada a 128 bits
// Dos propósitos, que no se pueden intercambiar (el propósito va firmado):
//   - "unsub": baja del resumen semanal. Caduca a los 90 días.
//   - "optin": confirmación del alta (doble opt-in). Caduca a los 7 días y
//     lleva la versión del texto aceptado y una huella de la dirección a la
//     que se envió: si la persona cambia de correo, el enlace viejo no vale.
// - No enumerable: sin el secreto no se puede fabricar uno válido para otra
//   persona (cambiar un carácter del id invalida la firma).
// - La comparación de la firma es de tiempo constante.
// - Sin estado: verificar no necesita la base; repetir la acción no cambia
//   nada (lo garantiza la base).
// ============================================================

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 3600
export const OPTIN_TOKEN_TTL_SECONDS = 7 * 24 * 3600
const VERSION = 'v1'
const SIG_BYTES = 16
/** Un token válido mide ~110-160 caracteres; nada razonable pasa de 240. */
const MAX_TOKEN_LENGTH = 240
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TEXT_VERSION = /^[a-z0-9][a-z0-9.-]{0,31}$/
const EMAIL_HASH = /^[A-Za-z0-9_-]{22}$/

type Purpose = 'unsub' | 'optin'

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function sign(body: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}.${body}`).digest().subarray(0, SIG_BYTES)
}

/** Huella corta de la dirección (minúsculas, sin espacios): no va en claro en el enlace. */
export function emailFingerprint(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest().subarray(0, 16).toString('base64url')
}

function create(purpose: Purpose, userId: string, ttl: number, extra: string[], secret: string, now: Date): string {
  if (!UUID.test(userId)) throw new Error('email token: user id must be a uuid')
  const exp = Math.floor(now.getTime() / 1000) + ttl
  const body = [purpose, userId, String(exp), ...extra].join(':')
  return `${VERSION}.${b64url(body)}.${b64url(sign(body, secret))}`
}

type Raw = { ok: true; fields: string[]; userId: string; expiresAt: Date } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

function verify(token: unknown, purpose: Purpose, extraCount: number, secret: string, now: Date): Raw {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'malformed' }
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, reason: 'malformed' }
  const [, bodyPart, sigPart] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(bodyPart) || !/^[A-Za-z0-9_-]+$/.test(sigPart)) return { ok: false, reason: 'malformed' }

  const body = Buffer.from(bodyPart, 'base64url').toString('utf8')
  const given = Buffer.from(sigPart, 'base64url')
  const expected = sign(body, secret)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' }
  }

  const [p, userId, expRaw, ...fields] = body.split(':')
  if (p !== purpose || fields.length !== extraCount || !UUID.test(userId ?? '') || !/^\d{9,11}$/.test(expRaw ?? '')) {
    return { ok: false, reason: 'malformed' }
  }
  const exp = Number(expRaw)
  if (exp * 1000 < now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, fields, userId, expiresAt: new Date(exp * 1000) }
}

export type TokenCheck =
  | { ok: true; userId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

export function createUnsubscribeToken(userId: string, secret: string, now: Date = new Date()): string {
  return create('unsub', userId, UNSUBSCRIBE_TOKEN_TTL_SECONDS, [], secret, now)
}

export function verifyUnsubscribeToken(token: unknown, secret: string, now: Date = new Date()): TokenCheck {
  const raw = verify(token, 'unsub', 0, secret, now)
  return raw.ok ? { ok: true, userId: raw.userId, expiresAt: raw.expiresAt } : raw
}

export type OptinCheck =
  | { ok: true; userId: string; expiresAt: Date; textVersion: string; emailHash: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

/** Enlace de confirmación del alta, atado a la versión del texto y a la dirección. */
export function createOptinToken(
  userId: string,
  email: string,
  textVersion: string,
  secret: string,
  now: Date = new Date()
): string {
  if (!TEXT_VERSION.test(textVersion)) throw new Error('optin token: invalid text version')
  return create('optin', userId, OPTIN_TOKEN_TTL_SECONDS, [textVersion, emailFingerprint(email)], secret, now)
}

export function verifyOptinToken(token: unknown, secret: string, now: Date = new Date()): OptinCheck {
  const raw = verify(token, 'optin', 2, secret, now)
  if (!raw.ok) return raw
  const [textVersion, emailHash] = raw.fields
  if (!TEXT_VERSION.test(textVersion) || !EMAIL_HASH.test(emailHash)) return { ok: false, reason: 'malformed' }
  return { ok: true, userId: raw.userId, expiresAt: raw.expiresAt, textVersion, emailHash }
}
