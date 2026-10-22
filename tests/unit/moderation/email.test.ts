// ============================================================
// KULTURA — Aviso por email de cada denuncia (Resend por REST, F-11)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockLogError, counts, countQueries } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
  // Denuncias de hoy en `reports` (incluida la actual) o un error de base.
  counts: { total: 1, reporter: 1, error: null as null | { code: string } },
  countQueries: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: mockLogError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        gte: (c: string, v: unknown) => { filters[`${c}>=`] = v; return q },
        eq: (c: string, v: unknown) => { filters[c] = v; return q },
        then: (resolve: (v: unknown) => unknown) => {
          countQueries.push(filters)
          const n = 'reporter_id' in filters || 'contact_email' in filters ? counts.reporter : counts.total
          return Promise.resolve(counts.error ? { count: null, error: counts.error } : { count: n, error: null }).then(resolve)
        },
      }
      return q
    },
  }),
}))

import { sendEmail } from '@/lib/email/resend'
import {
  EMAIL_DAILY_GLOBAL_CAP,
  EMAIL_DAILY_PER_REPORTER_CAP,
  buildReportEmail,
  notifyReport,
  type ReportNotice,
} from '@/lib/email/moderation'
import { _resetStoreForTests } from '@/lib/rate-limit'

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

describe('notifyReport — tope diario (Resend Free: 100/día)', () => {
  beforeEach(() => {
    mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) })
    mockLogError.mockReset()
    countQueries.length = 0
    counts.total = 1
    counts.reporter = 1
    counts.error = null
    _resetStoreForTests()
    vi.stubGlobal('fetch', mockFetch)
    process.env.MODERATION_EMAIL = 'mod@kultura.test'
    process.env.RESEND_API_KEY = 're_test'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.MODERATION_EMAIL
    delete process.env.MODERATION_EMAIL_DAILY_CAP
  })

  const appNotice: ReportNotice = { ...notice, reporterId: 'user-1', contactEmail: null, origin: 'app' }

  it('cuenta las denuncias de hoy (UTC) en la tabla, en total y del mismo denunciante', async () => {
    await notifyReport(appNotice)
    expect(countQueries).toHaveLength(2)
    expect(countQueries[0]['created_at>=']).toMatch(/T00:00:00\.000Z$/)
    expect(countQueries[1]).toMatchObject({ reporter_id: 'user-1' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it(`pasado el tope global (${EMAIL_DAILY_GLOBAL_CAP}) no envía y lo registra en Sentry`, async () => {
    counts.total = EMAIL_DAILY_GLOBAL_CAP + 1
    const res = await notifyReport(appNotice)
    expect(res).toEqual({ ok: false, reason: 'daily_cap' })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith('moderation_email_daily_cap', expect.objectContaining({ cap: 'global', reference: notice.reference }))
  })

  it('justo en el tope todavía envía', async () => {
    counts.total = EMAIL_DAILY_GLOBAL_CAP
    expect((await notifyReport(appNotice)).ok).toBe(true)
  })

  it(`pasado el tope por denunciante (${EMAIL_DAILY_PER_REPORTER_CAP}) no envía; sin cuenta se cuenta por correo de contacto`, async () => {
    counts.reporter = EMAIL_DAILY_PER_REPORTER_CAP + 1
    expect(await notifyReport(notice)).toEqual({ ok: false, reason: 'daily_cap' })
    expect(countQueries[1]).toMatchObject({ contact_email: 'alguien@example.com' })
    expect(mockLogError).toHaveBeenCalledWith('moderation_email_daily_cap', expect.objectContaining({ cap: 'reporter' }))
  })

  it('MODERATION_EMAIL_DAILY_CAP cambia el tope global', async () => {
    process.env.MODERATION_EMAIL_DAILY_CAP = '5'
    counts.total = 6
    expect((await notifyReport(appNotice)).ok).toBe(false)
  })

  it('si no se puede contar (o no se guardó), tope en memoria: el undécimo del mismo usuario no sale', async () => {
    counts.error = { code: '42703' }
    for (let i = 0; i < EMAIL_DAILY_PER_REPORTER_CAP; i++) {
      expect((await notifyReport(appNotice)).ok).toBe(true)
    }
    expect(await notifyReport(appNotice)).toEqual({ ok: false, reason: 'daily_cap' })
    expect(mockFetch).toHaveBeenCalledTimes(EMAIL_DAILY_PER_REPORTER_CAP)
    // Con stored:false ni siquiera se consulta la tabla.
    countQueries.length = 0
    await notifyReport({ ...notice, stored: false, contactEmail: 'otra@example.com' })
    expect(countQueries).toHaveLength(0)
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
