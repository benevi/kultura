// ============================================================
// KULTURA — Enlace de baja firmado (F-28, CRE-9; RFC 8058)
//
// `v1.<cuerpo>.<firma>`, todo en base64url:
//   cuerpo = "unsub:<user_id>:<caduca, segundos Unix>"
//   firma  = HMAC-SHA256(EMAIL_TOKEN_SECRET, "v1." + cuerpo) truncada a 128 bits
// - No enumerable: sin el secreto no se puede fabricar uno válido para otra
//   persona (cambiar un carácter del id invalida la firma).
// - Con propósito: el prefijo "unsub" impide reutilizar la firma para otra cosa.
// - Caduca a los 90 días (el correo de hace tres meses ya no da de baja; para
//   eso están Ajustes). La comparación es de tiempo constante.
// - Sin estado: no hace falta guardar nada para verificarlo; dar de baja dos
//   veces con el mismo enlace no cambia nada (lo garantiza la base).
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto'

export const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 3600
const VERSION = 'v1'
const PURPOSE = 'unsub'
const SIG_BYTES = 16
/** Un token válido mide ~110 caracteres; nada razonable pasa de 200. */
const MAX_TOKEN_LENGTH = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function sign(body: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${VERSION}.${body}`).digest().subarray(0, SIG_BYTES)
}

export function createUnsubscribeToken(userId: string, secret: string, now: Date = new Date()): string {
  if (!UUID.test(userId)) throw new Error('unsubscribe token: user id must be a uuid')
  const exp = Math.floor(now.getTime() / 1000) + UNSUBSCRIBE_TOKEN_TTL_SECONDS
  const body = `${PURPOSE}:${userId}:${exp}`
  return `${VERSION}.${b64url(body)}.${b64url(sign(body, secret))}`
}

export type TokenCheck =
  | { ok: true; userId: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

export function verifyUnsubscribeToken(token: unknown, secret: string, now: Date = new Date()): TokenCheck {
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

  const [purpose, userId, expRaw, ...rest] = body.split(':')
  if (rest.length > 0 || purpose !== PURPOSE || !UUID.test(userId ?? '') || !/^\d{9,11}$/.test(expRaw ?? '')) {
    return { ok: false, reason: 'malformed' }
  }
  const exp = Number(expRaw)
  if (exp * 1000 < now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, userId, expiresAt: new Date(exp * 1000) }
}
