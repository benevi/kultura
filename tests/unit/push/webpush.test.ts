// @vitest-environment node
/**
 * F-33 · Cifrado (RFC 8291) y VAPID (RFC 8292) propios.
 *
 * El cifrado se comprueba byte a byte con el ejemplo del §5 del RFC 8291
 * (mismas claves, sal y texto) y, además, descifrando lo que produce con la
 * clave privada del "navegador": si una sola derivación estuviera mal, la
 * etiqueta de AES-GCM no cuadraría.
 */
import { describe, it, expect, vi } from 'vitest'
import { createPublicKey, verify, generateKeyPairSync } from 'node:crypto'
import { encryptPayload, vapidAuthorization, sendPush, MAX_PLAINTEXT_BYTES } from '@/lib/push/webpush'
import { fromBase64Url, toBase64Url } from '@/lib/push/base64url'
import type { PushConfig } from '@/lib/push/config'

const b = (s: string) => fromBase64Url(s)!
const subtle = globalThis.crypto.subtle
const enc = new TextEncoder()

// RFC 8291 §5 — "Push Message Encryption Example".
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8w' +
    'EqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

/** Descifrado del lado del navegador (RFC 8291 §3.4 al revés), escrito aparte. */
async function decrypt(body: Uint8Array<ArrayBuffer>, uaPublic: Uint8Array<ArrayBuffer>, uaPrivate: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ct = body.slice(21 + idlen)
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: toBase64Url(uaPublic.subarray(1, 33)), y: toBase64Url(uaPublic.subarray(33)), d: toBase64Url(uaPrivate),
  }
  const priv = await subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const pub = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256))
  const h = async (s: Uint8Array<ArrayBuffer>, k: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, n: number) =>
    new Uint8Array(
      await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await subtle.importKey('raw', k, 'HKDF', false, ['deriveBits']), n * 8),
    )
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await h(auth, secret, info, 32)
  const cek = await h(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await h(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct))
  let end = padded.length - 1
  while (end >= 0 && padded[end] === 0) end--
  expect(padded[end]).toBe(2) // delimitador del último registro
  return { rs, idlen, asPublic, text: new TextDecoder().decode(padded.slice(0, end)) }
}

describe('push · cifrado aes128gcm (RFC 8291)', () => {
  it('reproduce byte a byte el ejemplo del §5', async () => {
    const out = await encryptPayload(
      enc.encode(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: b(RFC.salt), senderPublicKey: b(RFC.asPublic), senderPrivateKey: b(RFC.asPrivate) },
    )
    expect(toBase64Url(out)).toBe(RFC.body)
  })

  it('el ejemplo del RFC se descifra con la clave del navegador (el vector es el bueno)', async () => {
    const r = await decrypt(b(RFC.body), b(RFC.uaPublic), b(RFC.uaPrivate), b(RFC.auth))
    expect(r.text).toBe(RFC.plaintext)
  })

  it('con claves efímeras y sal al azar: cabecera correcta, se descifra y nunca repite', async () => {
    const a = await encryptPayload(enc.encode('{"title":"Hola"}'), { p256dh: RFC.uaPublic, auth: RFC.auth })
    const c = await encryptPayload(enc.encode('{"title":"Hola"}'), { p256dh: RFC.uaPublic, auth: RFC.auth })
    expect(toBase64Url(a)).not.toBe(toBase64Url(c))
    const r = await decrypt(a, b(RFC.uaPublic), b(RFC.uaPrivate), b(RFC.auth))
    expect(r).toMatchObject({ rs: 4096, idlen: 65, text: '{"title":"Hola"}' })
    expect(r.asPublic[0]).toBe(4)
  })

  it('rechaza claves del navegador mal formadas y textos que no caben', async () => {
    await expect(encryptPayload(enc.encode('x'), { p256dh: 'abc', auth: RFC.auth })).rejects.toThrow('p256dh')
    await expect(encryptPayload(enc.encode('x'), { p256dh: RFC.uaPublic, auth: 'abc' })).rejects.toThrow('auth')
    await expect(
      encryptPayload(new Uint8Array(MAX_PLAINTEXT_BYTES + 1), { p256dh: RFC.uaPublic, auth: RFC.auth }),
    ).rejects.toThrow('too large')
    const max = await encryptPayload(new Uint8Array(MAX_PLAINTEXT_BYTES), { p256dh: RFC.uaPublic, auth: RFC.auth })
    expect(max.length).toBe(4096)
  })
})

/** Par VAPID de PRUEBA generado en el momento (nunca hay claves en el repo). */
function testConfig(): PushConfig {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })
  const raw = new Uint8Array([4, ...b(pub.x!), ...b(pub.y!)])
  return {
    publicKey: toBase64Url(raw),
    publicKeyBytes: raw,
    privateKey: priv.d!,
    subject: 'mailto:kultura.app.contacto@gmail.com',
    dispatchSecret: 's'.repeat(40),
  }
}

describe('push · VAPID (RFC 8292)', () => {
  it('JWT ES256 con aud = origen del servicio, exp ≤ 24 h, sub y firma verificable con la pública', async () => {
    const config = testConfig()
    const now = Date.UTC(2026, 11, 22, 10)
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', config, now)
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
    expect(m[2]).toBe(config.publicKey)
    const [h, c, s] = m[1].split('.')
    expect(JSON.parse(new TextDecoder().decode(b(h)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = JSON.parse(new TextDecoder().decode(b(c)))
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:kultura.app.contacto@gmail.com')
    expect(claims.exp - now / 1000).toBeGreaterThan(3600)
    expect(claims.exp - now / 1000).toBeLessThanOrEqual(24 * 3600)
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: toBase64Url(config.publicKeyBytes.subarray(1, 33)), y: toBase64Url(config.publicKeyBytes.subarray(33)) },
      format: 'jwk',
    })
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(b(s)))
    expect(ok).toBe(true)
  })

  it('un JWT por servicio push (aud distinto) y reutilizado mientras le quede más de 1 h', async () => {
    const config = testConfig()
    const now = Date.UTC(2026, 11, 22, 10)
    const fcm1 = await vapidAuthorization('https://fcm.googleapis.com/a', config, now)
    const fcm2 = await vapidAuthorization('https://fcm.googleapis.com/b', config, now + 60_000)
    const apple = await vapidAuthorization('https://web.push.apple.com/x', config, now)
    expect(fcm2).toBe(fcm1)
    expect(apple).not.toBe(fcm1)
    const later = await vapidAuthorization('https://fcm.googleapis.com/a', config, now + 11.5 * 3600_000)
    expect(later).not.toBe(fcm1)
  })
})

describe('push · envío', () => {
  const keys = { p256dh: RFC.uaPublic, auth: RFC.auth }

  it('POST cifrado con las cabeceras del protocolo y sin seguir redirecciones', async () => {
    const config = testConfig()
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    const out = await sendPush(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys, payload: { title: 'Hola' }, ttl: 3600, urgency: 'high', topic: 'a'.repeat(32) },
      config,
      fetchMock as unknown as typeof fetch,
    )
    expect(out).toEqual({ status: 'sent', httpStatus: 201 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    const headers = init.headers as Record<string, string>
    expect(headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
      Topic: 'a'.repeat(32),
    })
    expect(headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/)
    const r = await decrypt(init.body as Uint8Array<ArrayBuffer>, b(RFC.uaPublic), b(RFC.uaPrivate), b(RFC.auth))
    expect(JSON.parse(r.text)).toEqual({ title: 'Hola' })
  })

  it('404/410 = suscripción caducada; 429, 5xx, red y endpoints fuera de la lista = fallo', async () => {
    const config = testConfig()
    const at = (status: number) => vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch
    const msg = { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys, payload: {} }
    expect(await sendPush(msg, config, at(410))).toEqual({ status: 'gone', httpStatus: 410 })
    expect(await sendPush(msg, config, at(404))).toEqual({ status: 'gone', httpStatus: 404 })
    expect(await sendPush(msg, config, at(429))).toMatchObject({ status: 'failed', httpStatus: 429 })
    expect(await sendPush(msg, config, at(503))).toMatchObject({ status: 'failed', httpStatus: 503 })
    expect(await sendPush(msg, config, at(302))).toMatchObject({ status: 'failed', httpStatus: 302 })
    const down = vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    expect(await sendPush(msg, config, down)).toMatchObject({ status: 'failed', httpStatus: null })
    const never = vi.fn()
    expect(
      await sendPush({ ...msg, endpoint: 'https://169.254.169.254/latest' }, config, never as unknown as typeof fetch),
    ).toMatchObject({ status: 'failed', reason: 'endpoint_not_allowed' })
    expect(never).not.toHaveBeenCalled()
  })

  it('un topic que no cumple el formato no se manda', async () => {
    const config = testConfig()
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    await sendPush(
      { endpoint: 'https://web.push.apple.com/abc', keys, payload: {}, topic: 'con espacios y demasiado largo para un topic' },
      config,
      fetchMock as unknown as typeof fetch,
    )
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>).Topic).toBeUndefined()
  })
})
