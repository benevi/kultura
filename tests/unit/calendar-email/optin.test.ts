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
import {
  OPTIN_TOKEN_TTL_SECONDS,
  createOptinToken,
  createUnsubscribeToken,
  emailFingerprint,
  verifyOptinToken,
} from '@/lib/email/unsubscribe-token'
import { WEEKLY_EMAIL_CONSENT_VERSION } from '@/lib/email/consent'
import { buildOptinEmail } from '@/lib/email/optin-template'
import { stripSensitiveQuery } from '@/components/analytics/VercelAnalytics'
import { _resetStoreForTests } from '@/lib/rate-limit'

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

/**
 * Lo que hace `email_optin_claim` en la base (probado aparte sobre PostgreSQL
 * 16): 10 min entre enlaces, N al día por persona y un tope global en 24 h.
 * Persiste entre peticiones y NO lo toca la baja.
 */
const claims = { log: [] as Array<{ user: string; at: number }>, now: Date.now() }
function fakeClaim(args: { p_user: string; p_user_daily: number; p_global_daily: number; p_cooldown: string }) {
  const minutes = Number(/^(\d+) minutes$/.exec(args.p_cooldown)?.[1])
  const day = claims.now - 86400_000
  const mine = claims.log.filter((c) => c.user === args.p_user)
  if (mine.some((c) => c.at > claims.now - minutes * 60_000)) return 'cooldown'
  if (mine.filter((c) => c.at > day).length >= args.p_user_daily) return 'user_cap'
  if (claims.log.filter((c) => c.at > day).length >= args.p_global_daily) return 'global_cap'
  claims.log.push({ user: args.p_user, at: claims.now })
  return 'ok'
}

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
  const plainRpc = base.rpc
  base.rpc = async (fn: string, args: unknown) => {
    if (fn !== 'email_optin_claim' || opts.adminRpc?.email_optin_claim) return plainRpc(fn, args)
    base.rpcCalls.push({ fn, args })
    return { data: fakeClaim(args as Parameters<typeof fakeClaim>[0]), error: null }
  }
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
  _resetStoreForTests()
  claims.log = []
  claims.now = Date.now()
  Object.assign(process.env, ENV)
  h.user = { id: U1, email: 'ana@example.com', email_confirmed_at: CONFIRMED, app_metadata: {} }
  h.adminUser = { id: U1, email: 'ana@example.com', email_confirmed_at: CONFIRMED }
  h.send.mockResolvedValue({ ok: true, id: 're_1' })
  setup()
})
afterEach(() => {
  for (const k of [...Object.keys(ENV), 'WEEKLY_EMAIL_ONLY', 'WEEKLY_EMAIL_OPTIN_DAILY_CAP']) delete process.env[k]
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
    // Ni alta ni consentimiento registrados: solo se reserva el envío con los topes.
    expect(server.rpcCalls).toEqual([])
    expect(admin.rpcCalls).toEqual([
      { fn: 'email_optin_claim', args: { p_user: U1, p_user_daily: 3, p_global_daily: 20, p_cooldown: '10 minutes' } },
    ])
    expect(opsOf(admin, 'email_preferences', 'upsert')).toEqual([])
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
    expect((await enable()).status).toBe(202)
    const res = await enable()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'cooldown' })
    expect(h.send).toHaveBeenCalledTimes(1)
  })

  // Regresión (revisión #49): la baja ponía optin_requested_at a null y
  // alternar alta/baja mandaba ~15 correos por minuto.
  it('alternar alta y baja NO salta el límite', async () => {
    setup({ rpc: { set_email_weekly: { data: [{ weekly_digest: false, consent_version: null, consented_at: null }], error: null } } })
    // 12 alternancias (24 peticiones) caben en el límite de la ruta (30/min):
    // lo que frena son los topes de la base, no el de peticiones.
    for (let i = 0; i < 12; i++) {
      await enable()
      await put({ weekly: false })
    }
    expect(h.send).toHaveBeenCalledTimes(1)
  })

  it('3 confirmaciones al día por persona (aunque esperes los 10 min)', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await enable()).status).toBe(202)
      claims.now += 11 * 60_000
    }
    const res = await enable()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'daily_limit' })
    expect(h.send).toHaveBeenCalledTimes(3)
    claims.now += 24 * 3600_000
    expect((await enable()).status).toBe(202)
  })

  it('tope global diario configurable (WEEKLY_EMAIL_OPTIN_DAILY_CAP): 503 busy', async () => {
    process.env.WEEKLY_EMAIL_OPTIN_DAILY_CAP = '2'
    const users = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
    const statuses: number[] = []
    for (const id of users) {
      h.user = { id, email: `${id.slice(0, 4)}@example.com`, email_confirmed_at: CONFIRMED, app_metadata: {} }
      const res = await enable()
      statuses.push(res.status)
      if (res.status === 503) expect(await res.json()).toEqual({ error: 'busy' })
    }
    expect(statuses).toEqual([202, 202, 503])
    expect(h.send).toHaveBeenCalledTimes(2)
    expect((admin.rpcCalls.at(-1)?.args as { p_global_daily: number }).p_global_daily).toBe(2)
  })

  it('un envío fallido cuenta para los topes (no se reintenta en bucle)', async () => {
    h.send.mockResolvedValue({ ok: false, reason: 'http_error', status: 500 })
    expect((await enable()).status).toBe(502)
    expect((await enable()).status).toBe(429)
  })

  it('activo con otra dirección (la cambió): se pide confirmar la nueva', async () => {
    setup({ prefs: { weekly_digest: true, consent_version: WEEKLY_EMAIL_CONSENT_VERSION, consented_at: CONFIRMED, confirmed_email_hash: emailFingerprint('vieja@example.com') } })
    expect((await enable()).status).toBe(202)
    expect(h.send.mock.calls[0][0].to).toBe('ana@example.com')
  })

  it('ya activo con este texto y esta dirección: 200 y nada más', async () => {
    setup({ prefs: { weekly_digest: true, consent_version: WEEKLY_EMAIL_CONSENT_VERSION, consented_at: CONFIRMED, confirmed_email_hash: emailFingerprint('ana@example.com') } })
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
  const confirmed = { email_confirm_weekly: { data: 'ok', error: null } }

  it('enlace válido: activa y registra el consentimiento, la versión y la huella de la dirección', async () => {
    setup({ adminRpc: confirmed })
    const issued = new Date(Math.floor(Date.now() / 1000) * 1000 - 3600_000)
    const res = await post(token('ana@example.com', WEEKLY_EMAIL_CONSENT_VERSION, issued), 'en')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://k.test/en/email/confirm?status=done')
    expect(admin.rpcCalls).toEqual([
      {
        fn: 'email_confirm_weekly',
        args: {
          p_user: U1,
          p_text_version: WEEKLY_EMAIL_CONSENT_VERSION,
          p_email_hash: emailFingerprint('ana@example.com'),
          p_issued_at: issued.toISOString(),
        },
      },
    ])
    expect(OPTIN_TOKEN_TTL_SECONDS).toBe(7 * 86400)
  })

  it('enlace emitido antes de una baja posterior (superseded): no vale', async () => {
    setup({ adminRpc: { email_confirm_weekly: { data: 'superseded', error: null } } })
    expect((await post(token())).headers.get('location')).toContain('status=invalid')
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
    setup({ adminRpc: { email_confirm_weekly: { data: 'unchanged', error: null } } })
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
