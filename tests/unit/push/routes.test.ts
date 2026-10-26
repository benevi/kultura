// @vitest-environment node
/**
 * F-33 · /api/push/status, subscribe, unsubscribe y dispatch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { fakeDb, type FakeDb } from './fake-db'
import { toBase64Url, fromBase64Url } from '@/lib/push/base64url'
import { endpointHash } from '@/lib/push/endpoint'

const state: { user: { id: string; app_metadata?: Record<string, unknown> } | null; db: FakeDb; admin: FakeDb } = {
  user: null,
  db: fakeDb(),
  admin: fakeDb(),
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (t: string) => state.db.from(t),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (t: string) => state.admin.from(t) }) }))
const dispatchMock = vi.fn(async () => ({ status: 'done', sent: 1, removed: 0, failed: 0 }))
vi.mock('@/lib/push/dispatch', () => ({ dispatchPush: (...a: unknown[]) => dispatchMock(...(a as [])) }))

import { GET as status } from '@/app/api/push/status/route'
import { POST as subscribe } from '@/app/api/push/subscribe/route'
import { POST as unsubscribe } from '@/app/api/push/unsubscribe/route'
import { POST as dispatch } from '@/app/api/push/dispatch/route'
import { _resetStoreForTests } from '@/lib/rate-limit'

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const SECRET = 'z'.repeat(48)
const P256DH = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg'
const EP = 'https://fcm.googleapis.com/fcm/send/mine'

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  return {
    pub: toBase64Url(new Uint8Array([4, ...fromBase64Url(pub.x!)!, ...fromBase64Url(pub.y!)!])),
    priv: privateKey.export({ format: 'jwk' }).d!,
  }
}
const pair = keys()

function enablePush() {
  vi.stubEnv('PUSH_ENABLED', '1')
  vi.stubEnv('VAPID_PUBLIC_KEY', pair.pub)
  vi.stubEnv('VAPID_PRIVATE_KEY', pair.priv)
  vi.stubEnv('PUSH_DISPATCH_SECRET', SECRET)
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://kulturaapp.vercel.app/api/push/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const row = (id: string, user: string, endpoint: string, extra: Record<string, unknown> = {}) => ({
  id, user_id: user, endpoint, p256dh: P256DH, auth: AUTH, locale: 'es', updated_at: `2026-12-0${id.length % 9}`, ...extra,
})

beforeEach(() => {
  _resetStoreForTests()
  state.user = { id: ME }
  state.db = fakeDb({ push_subscriptions: [] })
  state.admin = state.db
  dispatchMock.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv('PUSH_ENABLED', '')
  vi.stubEnv('VAPID_PUBLIC_KEY', '')
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
  vi.stubEnv('VAPID_PRIVATE_KEY', '')
  vi.stubEnv('PUSH_DISPATCH_SECRET', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('GET /api/push/status', () => {
  it('sin sesión → 401', async () => {
    state.user = null
    expect((await status()).status).toBe(401)
  })

  it('sin bandera o sin migración → enabled: false (Ajustes no enseña nada)', async () => {
    expect(await (await status()).json()).toEqual({ enabled: false, publicKey: null, devices: 0, endpointHashes: [] })
    enablePush()
    state.db.errors.push_subscriptions = { code: '42P01', message: 'missing' }
    expect((await (await status()).json()).enabled).toBe(false)
  })

  it('activado: clave pública y huellas de MIS suscripciones (no los endpoints)', async () => {
    enablePush()
    state.db.tables.push_subscriptions = [row('1', ME, EP), row('2', OTHER, 'https://fcm.googleapis.com/fcm/send/other')]
    const res = await status()
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({ enabled: true, publicKey: pair.pub, devices: 1, endpointHashes: [await endpointHash(EP)] })
    expect(JSON.stringify(body)).not.toContain('fcm.googleapis.com')
    expect(state.db.log[0].filters).toContain(`user_id=${ME}`)
  })
})

describe('POST /api/push/subscribe', () => {
  const body = { endpoint: EP, keys: { p256dh: P256DH, auth: AUTH }, expirationTime: null, locale: 'en' }

  it('sin sesión 401; demo 403; sin bandera 503 push_disabled', async () => {
    state.user = null
    expect((await subscribe(post(body))).status).toBe(401)
    state.user = { id: ME, app_metadata: { demo: true } }
    expect((await subscribe(post(body))).status).toBe(403)
    state.user = { id: ME }
    const res = await subscribe(post(body))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'push_disabled' })
    expect(state.db.tables.push_subscriptions).toEqual([])
  })

  it('valida con zod y corta endpoints fuera de la lista (SSRF)', async () => {
    enablePush()
    const bad = await subscribe(post({ ...body, endpoint: 'https://169.254.169.254/latest/meta-data' }))
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'endpoint_not_allowed' })
    expect((await subscribe(post({ ...body, keys: { p256dh: 'x', auth: AUTH } }))).status).toBe(400)
    expect((await subscribe(post('no json'))).status).toBe(400)
    expect((await subscribe(post({ ...body, expirationTime: Date.now() - 1000 }))).status).toBe(400)
    expect(state.db.tables.push_subscriptions).toEqual([])
  })

  it('guarda la suscripción de la sesión (201) y la refresca sin duplicar (200)', async () => {
    enablePush()
    const first = await subscribe(post(body))
    expect(first.status).toBe(201)
    expect(state.db.tables.push_subscriptions).toHaveLength(1)
    expect(state.db.tables.push_subscriptions[0]).toMatchObject({ user_id: ME, endpoint: EP, p256dh: P256DH, auth: AUTH, locale: 'en', expires_at: null })
    const again = await subscribe(post({ ...body, expirationTime: Date.now() + 86_400_000 }))
    expect(again.status).toBe(200)
    expect(state.db.tables.push_subscriptions).toHaveLength(1)
    expect(state.db.tables.push_subscriptions[0].expires_at).toEqual(expect.any(String))
  })

  it('el mismo navegador con otra cuenta: la fila anterior se libera con admin', async () => {
    enablePush()
    state.db.tables.push_subscriptions = [row('9', OTHER, EP)]
    expect((await subscribe(post(body))).status).toBe(201)
    expect(state.db.tables.push_subscriptions.map((r) => r.user_id)).toEqual([ME])
    expect(state.db.log.find((l) => l.op === 'delete')!.filters).toEqual([`endpoint=${EP}`, `user_id!=${ME}`])
  })

  it('pushsubscriptionchange: sustituye el endpoint viejo y conserva su idioma', async () => {
    enablePush()
    const OLD = 'https://fcm.googleapis.com/fcm/send/old'
    state.db.tables.push_subscriptions = [row('1', ME, OLD, { locale: 'en' })]
    const { locale: _l, ...noLocale } = body
    void _l
    await subscribe(post({ ...noLocale, replaces: OLD }))
    expect(state.db.tables.push_subscriptions.map((r) => [r.endpoint, r.locale])).toEqual([[EP, 'en']])
  })

  it('como mucho 10 dispositivos: entra el nuevo y sale el más antiguo', async () => {
    enablePush()
    state.db.tables.push_subscriptions = Array.from({ length: 10 }, (_, i) =>
      row(`r${i}`, ME, `https://fcm.googleapis.com/fcm/send/d${i}`, { updated_at: `2026-12-${String(10 + i)}` }),
    )
    await subscribe(post(body))
    const eps = state.db.tables.push_subscriptions.map((r) => r.endpoint)
    expect(eps).toHaveLength(10)
    expect(eps).toContain(EP)
    expect(eps).not.toContain('https://fcm.googleapis.com/fcm/send/d0')
  })

  it('sin migración → 503 push_unavailable', async () => {
    enablePush()
    state.db.errors.push_subscriptions = { code: 'PGRST205', message: 'missing' }
    const res = await subscribe(post(body))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'push_unavailable' })
  })
})

describe('POST /api/push/unsubscribe', () => {
  it('borra solo la mía de este navegador, o todas las mías con all', async () => {
    state.db.tables.push_subscriptions = [
      row('1', ME, EP),
      row('2', ME, 'https://web.push.apple.com/mine2'),
      row('3', OTHER, 'https://fcm.googleapis.com/fcm/send/other'),
    ]
    // Funciona aunque push esté apagado: darse de baja siempre se puede.
    const one = await unsubscribe(post({ endpoint: EP }))
    expect(await one.json()).toEqual({ ok: true, removed: 1 })
    const all = await unsubscribe(post({ all: true }))
    expect(await all.json()).toEqual({ ok: true, removed: 1 })
    expect(state.db.tables.push_subscriptions.map((r) => r.id)).toEqual(['3'])
  })

  it('sin sesión 401, petición rara 400, sin migración ok', async () => {
    state.user = null
    expect((await unsubscribe(post({ all: true }))).status).toBe(401)
    state.user = { id: ME }
    expect((await unsubscribe(post({ endpoint: 'https://evil.com/x' }))).status).toBe(400)
    state.db.errors.push_subscriptions = { code: '42P01', message: 'missing' }
    expect(await (await unsubscribe(post({ all: true }))).json()).toEqual({ ok: true, removed: 0 })
  })
})

describe('POST /api/push/dispatch', () => {
  const event = { kind: 'message', id: '7a1c2d3e-4b5a-4c6d-8e7f-001122334455' }

  it('sin configuración no hace nada (503) y no llama al envío', async () => {
    const res = await dispatch(post(event, { Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(503)
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('exige el secreto exacto', async () => {
    enablePush()
    for (const auth of ['', 'Bearer ', `Bearer ${SECRET}x`, `bearer ${SECRET}`, SECRET]) {
      expect((await dispatch(post(event, auth ? { Authorization: auth } : {}))).status, auth).toBe(401)
    }
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('con el secreto: valida el evento y envía', async () => {
    enablePush()
    expect((await dispatch(post({ kind: 'message', id: 'x' }, { Authorization: `Bearer ${SECRET}` }))).status).toBe(400)
    const res = await dispatch(post(event, { Authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'done', sent: 1, removed: 0, failed: 0 })
    expect(dispatchMock).toHaveBeenCalledWith(event, expect.objectContaining({ config: expect.objectContaining({ publicKey: pair.pub }) }))
  })
})
