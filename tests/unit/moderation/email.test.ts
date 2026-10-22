// ============================================================
// KULTURA — Aviso por email de cada denuncia (Resend por REST, F-11)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: mockLogError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))

import { sendEmail } from '@/lib/email/resend'
import { buildReportEmail, notifyReport, type ReportNotice } from '@/lib/email/moderation'

const notice: ReportNotice = {
  reportId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  reference: 'KR-0F8FAD5B',
  targetType: 'media',
  targetId: 'movie_550',
  reason: 'spam',
  details: '<script>alert(1)</script>',
  reporterId: null,
  contactEmail: 'alguien@example.com',
  stored: true,
  origin: 'public_form',
}

const mockFetch = vi.fn()

describe('sendEmail (Resend REST)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.MODERATION_EMAIL
    delete process.env.MODERATION_EMAIL_FROM
  })

  it('sin RESEND_API_KEY no llama a nadie', async () => {
    const res = await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })
    expect(res).toEqual({ ok: false, reason: 'not_configured' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('con clave: POST a api.resend.com con Bearer, texto plano y reply_to', async () => {
    process.env.RESEND_API_KEY = 're_test'
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'email-1' }) })
    const res = await sendEmail({ to: 'mod@kultura.test', subject: 'Asunto', text: 'Cuerpo', replyTo: 'x@y.z' })
    expect(res).toEqual({ ok: true, id: 'email-1' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ to: ['mod@kultura.test'], subject: 'Asunto', text: 'Cuerpo', reply_to: 'x@y.z' })
    expect(body).not.toHaveProperty('html')
  })

  it('un 4xx/5xx de Resend no lanza: http_error con el estado', async () => {
    process.env.RESEND_API_KEY = 're_test'
    mockFetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toEqual({ ok: false, reason: 'http_error', status: 422 })
  })

  it('un fallo de red no lanza', async () => {
    process.env.RESEND_API_KEY = 're_test'
    mockFetch.mockRejectedValue(new Error('boom'))
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toEqual({ ok: false, reason: 'network_error' })
  })
})

describe('notifyReport', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockLogError.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.MODERATION_EMAIL
  })

  it('sin MODERATION_EMAIL → error al logger (Sentry.captureMessage) con la referencia, sin el correo del denunciante', async () => {
    const res = await notifyReport(notice)
    expect(res.ok).toBe(false)
    expect(mockLogError).toHaveBeenCalledWith(
      'moderation_email_not_configured',
      expect.objectContaining({ reference: 'KR-0F8FAD5B', targetType: 'media', targetId: 'movie_550' }),
    )
    expect(JSON.stringify(mockLogError.mock.calls)).not.toContain('alguien@example.com')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sin RESEND_API_KEY (pero con buzón) → también se registra', async () => {
    process.env.MODERATION_EMAIL = 'mod@kultura.test'
    await notifyReport(notice)
    expect(mockLogError).toHaveBeenCalledWith('moderation_email_not_configured', expect.any(Object))
  })

  it('con todo configurado manda el correo al buzón de moderación', async () => {
    process.env.MODERATION_EMAIL = 'mod@kultura.test'
    process.env.RESEND_API_KEY = 're_test'
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) })
    const res = await notifyReport(notice)
    expect(res.ok).toBe(true)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.to).toEqual(['mod@kultura.test'])
    expect(body.subject).toContain('KR-0F8FAD5B')
    expect(body.reply_to).toBe('alguien@example.com')
    expect(mockLogError).not.toHaveBeenCalled()
  })
})

describe('buildReportEmail', () => {
  it('incluye referencia, enlace a la ficha y el SQL para cerrarla', () => {
    const { subject, text } = buildReportEmail(notice)
    expect(subject).toBe('[KULTURA] Denuncia KR-0F8FAD5B · media · spam')
    expect(text).toContain('/es/media/movie/550')
    expect(text).toContain(`where id = '${notice.reportId}'`)
    expect(text).toContain('resolved_at = now()')
  })

  it('si no se pudo guardar lo avisa: el correo es el único registro', () => {
    const { text } = buildReportEmail({ ...notice, stored: false })
    expect(text).toContain('no se pudo guardar')
    expect(text).not.toContain('update public.reports')
  })
})
