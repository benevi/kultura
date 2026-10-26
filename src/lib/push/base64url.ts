// ============================================================
// KULTURA — base64url sin relleno (RFC 4648 §5) para Web Push
//
// Lo usan el navegador (claves de la suscripción, clave pública VAPID) y el
// servidor (cifrado y firma). Sin `Buffer`, para que valga en los dos lados.
// ============================================================

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const LOOKUP: Record<string, number> = Object.fromEntries(Array.from(ALPHABET, (c, i) => [c, i]))

export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63]
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63]
  }
  return out
}

/**
 * Acepta también base64 "normal" (`+`, `/`) y relleno `=`, que algunos
 * navegadores y `web-push generate-vapid-keys` pueden dar. Devuelve `null`
 * si hay un carácter que no es del alfabeto o la longitud es imposible.
 */
export function fromBase64Url(input: string): Uint8Array<ArrayBuffer> | null {
  const clean = input.trim().replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (clean.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let j = 0
  for (const c of clean) {
    const v = LOOKUP[c]
    if (v === undefined) return null
    buffer = ((buffer << 6) | v) & 0xffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[j++] = (buffer >> bits) & 255
    }
  }
  return out
}

/** Normaliza a base64url sin relleno (o `null` si no es base64 válido). */
export function normalizeBase64Url(input: string): string | null {
  const bytes = fromBase64Url(input)
  return bytes ? toBase64Url(bytes) : null
}
