// @vitest-environment node
/**
 * F-33 · Configuración, lista blanca anti-SSRF, base64url y validación zod.
 */
import { describe, it, expect } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readPushConfig, DEFAULT_VAPID_SUBJECT } from '@/lib/push/config'
import { isAllowedPushEndpoint, PUSH_SERVICE_HOSTS, endpointHash } from '@/lib/push/endpoint'
import { fromBase64Url, toBase64Url, normalizeBase64Url } from '@/lib/push/base64url'
import { subscribeSchema, unsubscribeSchema, dispatchSchema } from '@/lib/push/schemas'

/** Par VAPID de prueba generado en cada ejecución (nunca en el repo). */
function pair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  return {
    publicKey: toBase64Url(new Uint8Array([4, ...fromBase64Url(pub.x!)!, ...fromBase64Url(pub.y!)!])),
    privateKey: privateKey.export({ format: 'jwk' }).d!,
  }
}

const SECRET = 'x'.repeat(40)

describe('push · readPushConfig', () => {
  const keys = pair()
  const full = { PUSH_ENABLED: '1', VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, PUSH_DISPATCH_SECRET: SECRET }

  it('con todo bien: configuración normalizada y el contacto por defecto', () => {
    const r = readPushConfig(full)
    expect(r.problem).toBeNull()
    expect(r.config).toMatchObject({ publicKey: keys.publicKey, subject: DEFAULT_VAPID_SUBJECT, dispatchSecret: SECRET })
    expect(r.config!.publicKeyBytes.length).toBe(65)
  })

  it('sin la bandera o con cualquier valor que no sea 1, no hace nada', () => {
    expect(readPushConfig({ ...full, PUSH_ENABLED: undefined }).problem).toBe('flag_off')
    expect(readPushConfig({ ...full, PUSH_ENABLED: 'true' }).problem).toBe('flag_off')
    expect(readPushConfig({}).config).toBeNull()
  })

  it('detecta claves que faltan, mal formadas o que no son pareja', () => {
    expect(readPushConfig({ ...full, VAPID_PRIVATE_KEY: '' }).problem).toBe('missing_keys')
    expect(readPushConfig({ ...full, VAPID_PUBLIC_KEY: 'abc' }).problem).toBe('invalid_public_key')
    expect(readPushConfig({ ...full, VAPID_PRIVATE_KEY: 'abc' }).problem).toBe('invalid_private_key')
    expect(readPushConfig({ ...full, VAPID_PRIVATE_KEY: pair().privateKey }).problem).toBe('key_mismatch')
  })

  it('NEXT_PUBLIC_VAPID_PUBLIC_KEY vale como pública, pero si choca con VAPID_PUBLIC_KEY se apaga', () => {
    const { VAPID_PUBLIC_KEY: _omit, ...rest } = full
    void _omit
    expect(readPushConfig({ ...rest, NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey }).problem).toBeNull()
    expect(readPushConfig({ ...full, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pair().publicKey }).problem).toBe('public_key_conflict')
  })

  it('el contacto tiene que ser mailto: o https:, y el secreto de envío ≥ 32 caracteres', () => {
    expect(readPushConfig({ ...full, VAPID_SUBJECT: 'mailto:kultura.app.contacto@gmail.com' }).problem).toBeNull()
    expect(readPushConfig({ ...full, VAPID_SUBJECT: 'https://kulturaapp.vercel.app' }).problem).toBeNull()
    expect(readPushConfig({ ...full, VAPID_SUBJECT: 'kultura' }).problem).toBe('invalid_subject')
    expect(readPushConfig({ ...full, PUSH_DISPATCH_SECRET: 'corto' }).problem).toBe('missing_dispatch_secret')
  })

  it('acepta las claves con relleno o en base64 normal (como las puede dar otra herramienta)', () => {
    const padded = Buffer.from(fromBase64Url(keys.publicKey)!).toString('base64')
    expect(readPushConfig({ ...full, VAPID_PUBLIC_KEY: padded }).config?.publicKey).toBe(keys.publicKey)
  })
})

describe('push · lista blanca de servicios (anti-SSRF)', () => {
  it('acepta los cuatro servicios reales', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/dXyZ:APA91b',
      'https://fcm.googleapis.com/wp/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGx_0aB',
      'https://wns2-par02p.notify.windows.com/w/?token=AwYAAAB%2b',
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true)
    }
  })

  it('rechaza cualquier otra cosa', () => {
    for (const url of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://169.254.169.254/latest/meta-data/',
      'https://localhost/fcm',
      'https://evil.com/fcm.googleapis.com/x',
      'https://fcm.googleapis.com.evil.com/x',
      'https://evilfcm.googleapis.com.attacker.io/x',
      'https://xfcm.googleapis.com@evil.com/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://FCM.googleapis.com/x',
      'https://fcm.googleapis.com./x',
      'https://fcm.googleapis.com/',
      'https://fcm.googleapis.com/a b',
      `https://fcm.googleapis.com/${'a'.repeat(1100)}`,
      'javascript:alert(1)',
      '',
      42,
    ]) {
      expect(isAllowedPushEndpoint(url), String(url)).toBe(false)
    }
  })

  it('la migración tiene la misma lista que el código', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261222330001_push.sql'), 'utf8')
    const re = /endpoint ~ '\^https:\/\/\(\[a-z0-9-\]\+\\\.\)\*\(([^)]+)\)/.exec(sql)
    expect(re).not.toBeNull()
    expect(re![1].split('|').map((h) => h.replace(/\\\./g, '.'))).toEqual([...PUSH_SERVICE_HOSTS])
  })

  it('endpointHash: 16 hex, estable', async () => {
    const h = await endpointHash('https://fcm.googleapis.com/fcm/send/abc')
    expect(h).toMatch(/^[0-9a-f]{16}$/)
    expect(await endpointHash('https://fcm.googleapis.com/fcm/send/abc')).toBe(h)
  })
})

describe('push · base64url', () => {
  it('ida y vuelta para todas las longitudes', () => {
    for (let n = 0; n < 70; n++) {
      const bytes = new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37 + n) & 255))
      const s = toBase64Url(bytes)
      expect(s).toBe(Buffer.from(bytes).toString('base64url'))
      expect(Array.from(fromBase64Url(s)!)).toEqual(Array.from(bytes))
    }
  })
  it('acepta relleno y +/; rechaza caracteres raros', () => {
    expect(normalizeBase64Url('+/8=')).toBe('-_8')
    expect(fromBase64Url('ab$c')).toBeNull()
    expect(fromBase64Url('a')).toBeNull()
  })
})

describe('push · validación de las peticiones', () => {
  const p256dh = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
  const auth = 'BTBZMqHH6r4Tts7J_aSIgg'
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh, auth } }

  it('subscribe: válida, normaliza las claves y rechaza endpoints y claves malos', () => {
    expect(subscribeSchema.safeParse(ok).success).toBe(true)
    const padded = { ...ok, keys: { p256dh: Buffer.from(fromBase64Url(p256dh)!).toString('base64'), auth: auth + '==' } }
    const r = subscribeSchema.safeParse(padded)
    expect(r.success && r.data.keys).toEqual({ p256dh, auth })
    expect(subscribeSchema.safeParse({ ...ok, endpoint: 'https://10.0.0.1/x' }).success).toBe(false)
    expect(subscribeSchema.safeParse({ ...ok, keys: { p256dh: auth, auth } }).success).toBe(false)
    expect(subscribeSchema.safeParse({ ...ok, keys: { p256dh, auth: p256dh } }).success).toBe(false)
    expect(subscribeSchema.safeParse({ ...ok, locale: 'fr' }).success).toBe(false)
    expect(subscribeSchema.safeParse({ ...ok, replaces: 'https://evil.com/x' }).success).toBe(false)
  })

  it('unsubscribe: un endpoint de la lista o all: true', () => {
    expect(unsubscribeSchema.safeParse({ endpoint: ok.endpoint }).success).toBe(true)
    expect(unsubscribeSchema.safeParse({ all: true }).success).toBe(true)
    expect(unsubscribeSchema.safeParse({ all: false }).success).toBe(false)
    expect(unsubscribeSchema.safeParse({ endpoint: 'https://evil.com/x' }).success).toBe(false)
  })

  it('dispatch: tipo conocido e id uuid', () => {
    expect(dispatchSchema.safeParse({ kind: 'message', id: '6f1c2d3e-4b5a-4c6d-8e7f-001122334455' }).success).toBe(true)
    expect(dispatchSchema.safeParse({ kind: 'other', id: '6f1c2d3e-4b5a-4c6d-8e7f-001122334455' }).success).toBe(false)
    expect(dispatchSchema.safeParse({ kind: 'message', id: "1' or 1=1" }).success).toBe(false)
  })
})
