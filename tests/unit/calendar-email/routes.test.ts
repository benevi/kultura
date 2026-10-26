// ============================================================
// F-28 — /api/email/preferences (alta con consentimiento versionado),
// /api/email/unsubscribe (baja sin sesión: GET seguro, POST en 1 clic de
// RFC 8058, idempotente) y el cron diario (retención de analítica y correo).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown> },
  rpc: vi.fn(),
  adminRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
    rpc: h.rpc,
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: h.adminRpc }) }))
vi.mock('@/lib/demo', () => ({ isDemoUser: (u: { email?: string } | null) => u?.email === 'demo@kultura.test' }))

import { PUT } from '@/app/api/email/preferences/route'
import { GET as unsubGET, POST as unsubPOST } from '@/app/api/email/unsubscribe/route'
import { createUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { WEEKLY_EMAIL_CONSENT_VERSION } from '@/lib/email/consent'

const SECRET = 'k'.repeat(40)
const U1 = '11111111-1111-4111-8111-111111111111'
const ENV = {
  WEEKLY_EMAIL: '1',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: 'KULTURA <onboarding@resend.dev>',
  EMAIL_TOKEN_SECRET: SECRET,
}

function put(body: unknown) {
  return PUT(new Request('https://k.test/api/email/preferences', { method: 'PUT', body: JSON.stringify(body) }))
}

describe('PUT /api/email/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(process.env, ENV)
    h.user = { id: U1, email: 'ana@example.com', app_metadata: {} }
    h.rpc.mockResolvedValue({ data: [{ weekly_digest: true, consent_version: WEEKLY_EMAIL_CONSENT_VERSION, consented_at: '2026-12-14T06:00:00Z' }], error: null })
  })
  afterEach(() => {
    for (const k of [...Object.keys(ENV), 'WEEKLY_EMAIL_ONLY']) delete process.env[k]
  })

  it('sin sesión 401; demo 403', async () => {
    h.user = null
    expect((await put({ weekly: true })).status).toBe(401)
    h.user = { id: U1, email: 'demo@kultura.test' }
    expect((await put({ weekly: true })).status).toBe(403)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('cuerpo inválido 400', async () => {
    expect((await put({ weekly: 'sí' })).status).toBe(400)
  })

  it('alta: con la versión vigente, por la función de la base (registra el consentimiento)', async () => {
    const res = await put({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ weekly: true, consentedAt: '2026-12-14T06:00:00Z' })
    expect(h.rpc).toHaveBeenCalledWith('set_email_weekly', {
      p_enabled: true,
      p_text_version: WEEKLY_EMAIL_CONSENT_VERSION,
      p_source: 'settings',
    })
  })

  it('alta con un texto viejo: 409 y nada guardado', async () => {
    const res = await put({ weekly: true, consentVersion: '2020-01-v0' })
    expect(res.status).toBe(409)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('alta sin el correo semanal configurado (o fuera de WEEKLY_EMAIL_ONLY): 403', async () => {
    delete process.env.EMAIL_FROM
    expect((await put({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION })).status).toBe(403)
    process.env.EMAIL_FROM = ENV.EMAIL_FROM
    process.env.WEEKLY_EMAIL_ONLY = 'victor@example.com'
    expect((await put({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION })).status).toBe(403)
  })

  it('baja: siempre se acepta (aunque falte la configuración)', async () => {
    delete process.env.WEEKLY_EMAIL
    h.rpc.mockResolvedValue({ data: [{ weekly_digest: false, consent_version: 'x', consented_at: null }], error: null })
    const res = await put({ weekly: false })
    expect(res.status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('set_email_weekly', expect.objectContaining({ p_enabled: false }))
  })

  it('sin la migración: 503', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    expect((await put({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION })).status).toBe(503)
  })
})

describe('/api/email/unsubscribe', () => {
  const token = () => createUnsubscribeToken(U1, SECRET)
  const post = (body: string, query = '', type = 'application/x-www-form-urlencoded') =>
    unsubPOST(
      new NextRequest(`https://k.test/api/email/unsubscribe${query}`, {
        method: 'POST',
        headers: { 'content-type': type, 'x-forwarded-for': '203.0.113.9' },
        body,
      })
    )

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMAIL_TOKEN_SECRET = SECRET
    h.adminRpc.mockResolvedValue({ data: true, error: null })
  })
  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET
  })

  it('GET (prefetch de clientes de correo) NUNCA da de baja: lleva a la página que pide confirmar', async () => {
    const t = token()
    const res = await unsubGET(new NextRequest(`https://k.test/api/email/unsubscribe?t=${t}&l=en`))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`https://k.test/en/email/unsubscribe?t=${t}`)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(h.adminRpc).not.toHaveBeenCalled()
  })

  it('RFC 8058: POST List-Unsubscribe=One-Click con el token en la URL → 200 y baja', async () => {
    const res = await post('List-Unsubscribe=One-Click', `?t=${token()}&l=es`)
    expect(res.status).toBe(200)
    expect(h.adminRpc).toHaveBeenCalledWith('email_unsubscribe', { p_user: U1, p_source: 'one_click' })
  })

  it('RFC 8058 también en multipart/form-data', async () => {
    const boundary = 'XyZ'
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${boundary}--\r\n`
    const res = await post(body, `?t=${token()}`, `multipart/form-data; boundary=${boundary}`)
    expect(res.status).toBe(200)
    expect(h.adminRpc).toHaveBeenCalledWith('email_unsubscribe', { p_user: U1, p_source: 'one_click' })
  })

  it('formulario de la página → baja y 303 a ?status=done', async () => {
    const res = await post(`t=${encodeURIComponent(token())}&l=en`)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://k.test/en/email/unsubscribe?status=done')
    expect(h.adminRpc).toHaveBeenCalledWith('email_unsubscribe', { p_user: U1, p_source: 'unsubscribe_page' })
  })

  it('idempotente: dar de baja dos veces responde igual', async () => {
    const t = token()
    h.adminRpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null })
    expect((await post('List-Unsubscribe=One-Click', `?t=${t}`)).status).toBe(200)
    expect((await post('List-Unsubscribe=One-Click', `?t=${t}`)).status).toBe(200)
  })

  it('token falso o caducado: no toca la base', async () => {
    const res = await post('List-Unsubscribe=One-Click', '?t=v1.Zm9v.YmFy')
    expect(res.status).toBe(400)
    const page = await post('t=basura&l=es')
    expect(page.headers.get('location')).toBe('https://k.test/es/email/unsubscribe?status=invalid')
    const old = createUnsubscribeToken(U1, SECRET, new Date('2020-01-01T00:00:00Z'))
    expect((await post('List-Unsubscribe=One-Click', `?t=${old}`)).status).toBe(400)
    expect(h.adminRpc).not.toHaveBeenCalled()
  })

  it('sin la migración: como dado de baja (nadie puede estar apuntado)', async () => {
    h.adminRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    expect((await post('List-Unsubscribe=One-Click', `?t=${token()}`)).status).toBe(200)
  })

  it('base caída: 500 en 1 clic; en la página, error con opción de reintentar', async () => {
    h.adminRpc.mockResolvedValue({ data: null, error: { code: '57014' } })
    const t = token()
    expect((await post('List-Unsubscribe=One-Click', `?t=${t}`)).status).toBe(500)
    const page = await post(`t=${encodeURIComponent(t)}`)
    expect(page.headers.get('location')).toContain('status=error')
    expect(page.headers.get('location')).toContain(`t=${encodeURIComponent(t)}`)
  })

  it('sin EMAIL_TOKEN_SECRET no se puede verificar: 503', async () => {
    delete process.env.EMAIL_TOKEN_SECRET
    expect((await post('List-Unsubscribe=One-Click', `?t=${token()}`)).status).toBe(503)
  })

  it('cuerpo enorme: se rechaza', async () => {
    expect((await post('x'.repeat(5000))).status).toBe(400)
  })
})
