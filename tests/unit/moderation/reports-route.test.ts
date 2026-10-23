// ============================================================
// KULTURA — POST /api/reports (F-11)
//
// Regresión: `reports` solo tenía política INSERT. Un INSERT … RETURNING exige
// que la fila pase también la RLS de SELECT, así que `.insert().select('id')`
// fallaba SIEMPRE con 42501 y ninguna denuncia llegaba a guardarse. El mock
// reproduce ese comportamiento de Postgres.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const inserted: Array<Record<string, unknown>> = []
const visible: Record<string, Set<string>> = {}
const mockNotify = vi.fn()

const RLS_ERROR = { code: '42501', message: 'new row violates row-level security policy for table "reports"' }

function reportsTable() {
  return {
    insert: (row: Record<string, unknown>) => {
      const plain = Promise.resolve().then(() => {
        inserted.push(row)
        return { data: null, error: null }
      })
      return Object.assign(plain, {
        // Sin política SELECT en reports: el RETURNING no pasa la RLS.
        select: () => ({ single: async () => ({ data: null, error: RLS_ERROR }) }),
      })
    },
  }
}

function readableTable(table: string) {
  return {
    select: () => ({
      eq: (_col: string, value: string) => ({
        maybeSingle: async () => ({ data: visible[table]?.has(value) ? { id: value } : null, error: null }),
      }),
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => (table === 'reports' ? reportsTable() : readableTable(table)),
  }),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0, remaining: 1 }) }
})

vi.mock('@/lib/email/moderation', () => ({
  notifyReport: (...args: unknown[]) => mockNotify(...args),
}))

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const MESSAGE = 'cccccccc-0000-4000-8000-000000000003'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/reports/route')
  return POST(makeRequest(body))
}

describe('POST /api/reports', () => {
  beforeEach(() => {
    inserted.length = 0
    for (const k of Object.keys(visible)) delete visible[k]
    mockNotify.mockReset().mockResolvedValue({ ok: true, id: 'email-1' })
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null })
  })

  afterEach(() => {
    delete process.env.MODERATION_V2
  })

  it('REGRESIÓN: guarda la denuncia aunque reports no tenga política SELECT (sin RETURNING)', async () => {
    visible.users = new Set([OTHER])
    const res = await post({ targetType: 'user', targetId: OTHER, reason: 'harassment', details: 'Me insulta' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reference).toMatch(/^KR-[0-9A-F]{8}$/)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      id: body.reportId,
      reporter_id: ME,
      target_type: 'user',
      target_id: OTHER,
      reason: 'harassment: Me insulta',
    })
  })

  it('avisa por email al creador con la referencia y resolved_at nulo (no se manda)', async () => {
    visible.users = new Set([OTHER])
    const res = await post({ targetType: 'user', targetId: OTHER, reason: 'spam' })
    const body = await res.json()
    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify.mock.calls[0][0]).toMatchObject({
      reportId: body.reportId,
      reference: body.reference,
      targetType: 'user',
      targetId: OTHER,
      reason: 'spam',
      reporterId: ME,
      stored: true,
      origin: 'app',
    })
    expect(inserted[0]).not.toHaveProperty('resolved_at')
  })

  it('el texto libre del botón antiguo se guarda como motivo "other"', async () => {
    visible.users = new Set([OTHER])
    await post({ targetType: 'user', targetId: OTHER, reason: 'Spam de enlaces' })
    expect(inserted[0].reason).toBe('other: Spam de enlaces')
  })

  it('una ficha se puede denunciar aunque nadie la tenga en `media` (basta con el formato del id)', async () => {
    const res = await post({ targetType: 'media', targetId: 'movie_550', reason: 'sexual' })
    expect(res.status).toBe(201)
    const bad = await post({ targetType: 'media', targetId: 'no es un id', reason: 'sexual' })
    expect(bad.status).toBe(400)
  })

  it('no se denuncia uno a sí mismo', async () => {
    const res = await post({ targetType: 'user', targetId: ME, reason: 'spam' })
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('sin MODERATION_V2 los tipos nuevos (mensaje, post, grupo, lista) se rechazan', async () => {
    visible.messages = new Set([MESSAGE])
    const res = await post({ targetType: 'message', targetId: MESSAGE, reason: 'harassment' })
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('con MODERATION_V2 se denuncia un mensaje que quien denuncia puede ver', async () => {
    process.env.MODERATION_V2 = '1'
    visible.messages = new Set([MESSAGE])
    const res = await post({ targetType: 'message', targetId: MESSAGE, reason: 'harassment' })
    expect(res.status).toBe(201)
    expect(inserted[0]).toMatchObject({ target_type: 'message', target_id: MESSAGE })
  })

  it('un mensaje que la RLS no deja ver (conversación ajena) → 404, sin guardar', async () => {
    process.env.MODERATION_V2 = '1'
    const res = await post({ targetType: 'message', targetId: MESSAGE, reason: 'harassment' })
    expect(res.status).toBe(404)
    expect(inserted).toHaveLength(0)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await post({ targetType: 'media', targetId: 'movie_550' })
    expect(res.status).toBe(401)
  })
})
