// ============================================================
// F-28 — Doble opt-in del correo semanal.
// - PUT /api/email/preferences {weekly:true} NO activa nada: exige dirección
//   confirmada y texto vigente, apunta la petición y envía a ESA dirección un
//   enlace "optin" firmado. Nada se envía después hasta que se pulsa.
// - POST /api/email/confirm: con el enlace válido (firma, caducidad, misma
//   dirección, misma versión) activa y registra el consentimiento.
// - Vercel Analytics no registra `?t=` de esas páginas.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabase, opsOf, type FakeClient } from '../plataformas-listas/fake-supabase'

const h = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  server: null as unknown,
  admin: null as unknown,
  send: vi.fn(),
  adminUser: null as null | Record<string, unknown>,
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.server }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => h.admin }))
vi.mock('@/lib/demo', () => ({ isDemoUser: (u: { email?: string } | null) => u?.email === 'demo@kultura.test' }))
vi.mock('@/lib/email/resend', async (orig) => ({ ...(await orig<typeof import('@/lib/email/resend')>()), sendEmail: h.send }))

import { PUT } from '@/app/api/email/preferences/route'
import { POST as confirmPOST } from '@/app/api/email/confirm/route'
import { createOptinToken, createUnsubscribeToken, verifyOptinToken } from '@/lib/email/unsubscribe-token'
import { WEEKLY_EMAIL_CONSENT_VERSION } from '@/lib/email/consent'
import { buildOptinEmail } from '@/lib/email/optin-template'
import { stripSensitiveQuery } from '@/components/analytics/VercelAnalytics'

const SECRET = 'k'.repeat(40)
const U1 = '11111111-1111-4111-8111-111111111111'
const ENV = {
  WEEKLY_EMAIL: '1',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'KULTURA <onboarding@resend.dev>',
  EMAIL_TOKEN_SECRET: SECRET,
}
const CONFIRMED = '2026-12-01T00:00:00Z'

let server: FakeClient
let admin: FakeClient & { auth: { admin: { getUserById: (id: string) => Promise<unknown> } } }

function setup(opts: { prefs?: unknown; prefsError?: { code: string } | null; rpc?: Record<string, unknown>; adminRpc?: Record<string, unknown> } = {}) {
  server = fakeSupabase({
    tables: {
      email_preferences: [{ data: opts.prefs ?? null, error: opts.prefsError ?? null }],
      users: [{ data: { username: 'ana' }, error: null }],
    },
    rpc: opts.rpc as never,
  })
  ;(server.auth as { getUser: () => Promise<unknown> }).getUser = async () => ({ data: { user: h.user }, error: null })
  const base = fakeSupabase({ tables: { email_preferences: [{ data: null, error: null }] }, rpc: opts.adminRpc as never })
  admin = Object.assign(base, {
    auth: { admin: { getUserById: async () => ({ data: { user: h.adminUser }, error: null }) } },
  }) as typeof admin
  h.server = server
  h.admin = admin
}

function put(body: unknown) {
  return PUT(new Request('https://k.test/api/email/preferences', { method: 'PUT', body: JSON.stringify(body) }))
}
const enable = (extra: Record<string, unknown> = {}) =>
  put({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION, locale: 'es', ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(process.env, ENV)
  h.user = { id: U1, email: 'ana@example.com', email_confirmed_at: CONFIRMED, app_metadata: {} }
  h.adminUser = { id: U1, email: 'ana@example.com', email_confirmed_at: CONFIRMED }
  h.send.mockResolvedValue({ ok: true, id: 're_1' })
  setup()
})
afterEach(() => {
  for (const k of [...Object.keys(ENV), 'WEEKLY_EMAIL_ONLY']) delete process.env[k]
})

describe('PUT /api/email/preferences — pedir el alta', () => {
  it('sin sesión 401; demo 403; cuerpo inválido 400', async () => {
    h.user = null
    expect((await enable()).status).toBe(401)
    h.user = { id: U1, email: 'demo@kultura.test', email_confirmed_at: CONFIRMED }
    expect((await enable()).status).toBe(403)
    h.user = { id: U1, email: 'a@x.es', email_confirmed_at: CONFIRMED }
    expect((await put({ weekly: 'sí' })).status).toBe(400)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('dirección sin confirmar (email_confirmed_at vacío): 403 y ningún correo', async () => {
    h.user = { id: U1, email: 'ajeno@example.com', email_confirmed_at: null }
    const res = await enable()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'unconfirmed_email' })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('NO activa nada: 202 pendiente, apunta la petición y manda el enlace "optin" a la dirección de la cuenta', async () => {
    const res = await enable()
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ weekly: false, pending: true })
    // Ni alta ni consentimiento registrados todavía.
    expect(server.rpcCalls).toEqual([])
    expect(admin.rpcCalls).toEqual([])
    const upsert = opsOf(admin, 'email_preferences', 'upsert')[0].args
    expect(Object.keys(upsert[0] as object).sort()).toEqual(['optin_requested_at', 'user_id'])
    // El correo va a SU dirección, con un enlace de propósito "optin" atado a ella y a la versión.
    expect(h.send).toHaveBeenCalledTimes(1)
    const msg = h.send.mock.calls[0][0]
    expect(msg.to).toBe('ana@example.com')
    expect(msg.from).toBe(ENV.EMAIL_FROM)
    const link = /https:\/\/\S+\/es\/email\/confirm\?t=\S+/.exec(msg.text)?.[0]
    expect(link).toBeDefined()
    const check = verifyOptinToken(new URL(link!).searchParams.get('t'), SECRET)
    expect(check).toMatchObject({ ok: true, userId: U1, textVersion: WEEKLY_EMAIL_CONSENT_VERSION })
  })

  it('texto viejo: 409, sin correo', async () => {
    expect((await enable({ consentVersion: '2020-01-v0' })).status).toBe(409)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('sin configurar o fuera de WEEKLY_EMAIL_ONLY: 403', async () => {
    delete process.env.EMAIL_FROM
    expect((await enable()).status).toBe(403)
    process.env.EMAIL_FROM = ENV.EMAIL_FROM
    process.env.WEEKLY_EMAIL_ONLY = 'victor@example.com'
    expect((await enable()).status).toBe(403)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('un enlace cada 10 min como mucho (no se usa para llenar un buzón)', async () => {
    setup({ prefs: { weekly_digest: false, optin_requested_at: new Date(Date.now() - 60_000).toISOString() } })
    const res = await enable()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'cooldown' })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('ya activo con este texto: 200 y nada más', async () => {
    setup({ prefs: { weekly_digest: true, consent_version: WEEKLY_EMAIL_CONSENT_VERSION, consented_at: CONFIRMED } })
    const res = await enable()
    expect(res.status).toBe(200)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('sin la migración: 503', async () => {
    setup({ prefsError: { code: 'PGRST205' } })
    expect((await enable()).status).toBe(503)
  })

  it('si Resend falla: 502 send_failed', async () => {
    h.send.mockResolvedValue({ ok: false, reason: 'http_error', status: 403 })
    const res = await enable()
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'send_failed' })
  })

  it('baja: al momento, con la sesión (set_email_weekly false)', async () => {
    setup({ rpc: { set_email_weekly: { data: [{ weekly_digest: false, consent_version: 'v', consented_at: null }], error: null } } })
    const res = await put({ weekly: false })
    expect(res.status).toBe(200)
    expect(server.rpcCalls).toEqual([
      { fn: 'set_email_weekly', args: { p_enabled: false, p_text_version: WEEKLY_EMAIL_CONSENT_VERSION, p_source: 'settings' } },
    ])
  })
})

describe('POST /api/email/confirm — confirmar el alta', () => {
  const token = (email = 'ana@example.com', version = WEEKLY_EMAIL_CONSENT_VERSION, now = new Date()) =>
    createOptinToken(U1, email, version, SECRET, now)
  const post = (t: string, l = 'es') =>
    confirmPOST(
      new NextRequest('https://k.test/api/email/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.7' },
        body: `t=${encodeURIComponent(t)}&l=${l}`,
      })
    )
  const confirmed = { email_confirm_weekly: { data: true, error: null } }

  it('enlace válido: activa y registra el consentimiento (versión firmada), 303 a ?status=done', async () => {
    setup({ adminRpc: confirmed })
    const res = await post(token(), 'en')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://k.test/en/email/confirm?status=done')
    expect(admin.rpcCalls).toEqual([{ fn: 'email_confirm_weekly', args: { p_user: U1, p_text_version: WEEKLY_EMAIL_CONSENT_VERSION } }])
  })

  it('la dirección cambió desde que se pidió: no vale', async () => {
    setup({ adminRpc: confirmed })
    const res = await post(token('vieja@example.com'))
    expect(res.headers.get('location')).toContain('status=invalid')
    expect(admin.rpcCalls).toEqual([])
  })

  it('dirección sin confirmar en Auth: no vale', async () => {
    setup({ adminRpc: confirmed })
    h.adminUser = { id: U1, email: 'ana@example.com', email_confirmed_at: null }
    expect((await post(token())).headers.get('location')).toContain('status=invalid')
    expect(admin.rpcCalls).toEqual([])
  })

  it('caducado (más de 7 días), manipulado o de otro propósito: no vale', async () => {
    setup({ adminRpc: confirmed })
    const old = token('ana@example.com', WEEKLY_EMAIL_CONSENT_VERSION, new Date(Date.now() - 8 * 86400_000))
    expect((await post(old)).headers.get('location')).toContain('status=invalid')
    expect((await post(token().slice(0, -2) + 'AA')).headers.get('location')).toContain('status=invalid')
    expect((await post(createUnsubscribeToken(U1, SECRET))).headers.get('location')).toContain('status=invalid')
    expect(admin.rpcCalls).toEqual([])
  })

  it('el texto cambió desde que se pidió: stale, no se activa', async () => {
    setup({ adminRpc: confirmed })
    expect((await post(token('ana@example.com', '2020-01-v0'))).headers.get('location')).toContain('status=stale')
    expect(admin.rpcCalls).toEqual([])
  })

  it('desactivado (sin claves): no se puede confirmar', async () => {
    delete process.env.WEEKLY_EMAIL
    setup({ adminRpc: confirmed })
    expect((await post(token())).headers.get('location')).toContain('status=invalid')
  })

  it('pulsar dos veces: el mismo resultado (la base no duplica el registro)', async () => {
    setup({ adminRpc: { email_confirm_weekly: { data: false, error: null } } })
    expect((await post(token())).headers.get('location')).toContain('status=done')
  })

  it('base caída: error con opción de reintentar', async () => {
    setup({ adminRpc: { email_confirm_weekly: { data: null, error: { code: '57014' } } } })
    const loc = (await post(token())).headers.get('location')!
    expect(loc).toContain('status=error')
    expect(loc).toContain('t=')
  })
})

describe('correo de confirmación', () => {
  it('texto y HTML con el enlace, la caducidad y qué hacer si no lo pediste; todo escapado', () => {
    const mail = buildOptinEmail({ locale: 'es', username: '<b>ana</b>', confirmUrl: 'https://k.test/es/email/confirm?t=v1.a.b' })
    expect(mail.subject).toBe('Confirma tu resumen semanal de KULTURA')
    expect(mail.text).toContain('Confirmar: https://k.test/es/email/confirm?t=v1.a.b')
    expect(mail.text).toContain('7 días')
    expect(mail.text).toContain('ignora este correo')
    expect(mail.html).toMatch(/<html lang="es">/)
    expect(mail.html).not.toContain('<b>ana</b>')
    expect(mail.html).not.toMatch(/<img|<script/i)
    expect(buildOptinEmail({ locale: 'en', username: 'a', confirmUrl: 'https://x' }).subject).toBe('Confirm your KULTURA weekly digest')
  })
})

describe('Vercel Analytics sin tokens', () => {
  const ev = (url: string) => ({ type: 'pageview' as const, url })
  it.each([
    ['https://kulturaapp.vercel.app/es/email/unsubscribe?t=v1.secreto.firma', 'https://kulturaapp.vercel.app/es/email/unsubscribe'],
    ['https://kulturaapp.vercel.app/en/email/confirm?t=v1.secreto.firma&status=error', 'https://kulturaapp.vercel.app/en/email/confirm'],
    ['https://kulturaapp.vercel.app/es/calendar?utm_source=email&t=x', 'https://kulturaapp.vercel.app/es/calendar?utm_source=email'],
    ['https://kulturaapp.vercel.app/es/discover?type=movie', 'https://kulturaapp.vercel.app/es/discover?type=movie'],
  ])('%s', (input, output) => {
    expect(stripSensitiveQuery(ev(input)).url).toBe(output)
  })
})
