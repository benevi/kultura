// ============================================================
// KULTURA — Configuración de Web Push (F-33) · solo servidor
//
// Variables (Vercel → Settings → Environment Variables, y redeploy):
//   PUSH_ENABLED=1            bandera; con cualquier otro valor no se hace nada
//   VAPID_PUBLIC_KEY          clave pública (base64url, 65 bytes)  ┐ un par de
//   VAPID_PRIVATE_KEY         clave privada (base64url, 32 bytes)  ┘ `npx web-push
//                             generate-vapid-keys`. NUNCA con NEXT_PUBLIC_.
//   VAPID_SUBJECT             contacto para los servicios push (mailto: o https:)
//   PUSH_DISPATCH_SECRET      ≥ 32 caracteres; el mismo valor va en Vault
//                             (`push_dispatch_secret`) para que la base pueda
//                             llamar a /api/push/dispatch.
// NEXT_PUBLIC_VAPID_PUBLIC_KEY es opcional (la pública no es secreta): si se
// pone, tiene que ser igual que VAPID_PUBLIC_KEY. El navegador la recibe de
// /api/push/status, así que no hace falta recompilar al cambiarla.
//
// Sin la bandera, sin una clave o con un par que no casa, `readPushConfig`
// devuelve `config: null` y el motivo: nada se envía y nada falla.
// ============================================================

import 'server-only'
import { createECDH } from 'node:crypto'
import { fromBase64Url, toBase64Url } from './base64url'

export const DEFAULT_VAPID_SUBJECT = 'mailto:kultura.app.contacto@gmail.com'
export const MIN_DISPATCH_SECRET_LENGTH = 32

export interface PushConfig {
  /** base64url, 65 bytes (punto P-256 sin comprimir). */
  publicKey: string
  publicKeyBytes: Uint8Array<ArrayBuffer>
  /** base64url, 32 bytes. */
  privateKey: string
  subject: string
  dispatchSecret: string
}

export type PushConfigProblem =
  | 'flag_off'
  | 'missing_keys'
  | 'public_key_conflict'
  | 'invalid_public_key'
  | 'invalid_private_key'
  | 'key_mismatch'
  | 'invalid_subject'
  | 'missing_dispatch_secret'

export type PushConfigResult =
  | { config: PushConfig; problem: null }
  | { config: null; problem: PushConfigProblem }

type Env = Record<string, string | undefined>

const fail = (problem: PushConfigProblem): PushConfigResult => ({ config: null, problem })

function isValidSubject(subject: string): boolean {
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)) return true
  try {
    const url = new URL(subject)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

let memo: { key: string; result: PushConfigResult } | null = null

export function readPushConfig(env: Env = process.env): PushConfigResult {
  const flag = env.PUSH_ENABLED?.trim()
  const serverPublic = env.VAPID_PUBLIC_KEY?.trim() || ''
  const clientPublic = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || ''
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() || ''
  const subject = env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT
  const dispatchSecret = env.PUSH_DISPATCH_SECRET?.trim() || ''

  const key = [flag, serverPublic, clientPublic, privateKey, subject, dispatchSecret].join('\u0000')
  if (memo?.key === key) return memo.result

  const result = ((): PushConfigResult => {
    if (flag !== '1') return fail('flag_off')
    const publicKey = serverPublic || clientPublic
    if (!publicKey || !privateKey) return fail('missing_keys')
    if (serverPublic && clientPublic && serverPublic !== clientPublic) return fail('public_key_conflict')
    const publicKeyBytes = fromBase64Url(publicKey)
    if (!publicKeyBytes || publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) return fail('invalid_public_key')
    const privateBytes = fromBase64Url(privateKey)
    if (!privateBytes || privateBytes.length !== 32) return fail('invalid_private_key')
    try {
      const ecdh = createECDH('prime256v1')
      ecdh.setPrivateKey(privateBytes)
      if (!ecdh.getPublicKey().equals(publicKeyBytes)) return fail('key_mismatch')
    } catch {
      return fail('invalid_private_key')
    }
    if (!isValidSubject(subject)) return fail('invalid_subject')
    if (dispatchSecret.length < MIN_DISPATCH_SECRET_LENGTH) return fail('missing_dispatch_secret')
    return {
      config: { publicKey: toBase64Url(publicKeyBytes), publicKeyBytes, privateKey: toBase64Url(privateBytes), subject, dispatchSecret },
      problem: null,
    }
  })()

  memo = { key, result }
  return result
}

export function getPushConfig(env?: Env): PushConfig | null {
  return readPushConfig(env).config
}
