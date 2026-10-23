// ============================================================
// KULTURA — POST /api/reports/public: denuncia sin cuenta (F-11, DSA art. 16)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockNotify, mockRateLimit, inserted, state } = vi.hoisted(() => ({
  mockNotify: vi.fn(),
  mockRateLimit: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  state: {
    insertError: null as null | { code: string; message: string },
    users: new Map<string, string>(), // username → id
    publicLists: new Set<string>(),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'reports') {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (state.insertError) return { data: null, error: state.insertError }
            inserted.push(row)
            return { data: null, error: null }
          },
        }
      }
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        eq: (col: string, value: unknown) => {
          filters[col] = value
          return q
        },
        maybeSingle: async () => {
          if (table === 'users') {
            const id =
              'username' in filters
                ? state.users.get(filters.username as string)
                : Array.from(state.users.values()).find((v) => v === filters.id)
            return { data: id ? { id } : null, error: null }
          }
          if (table === 'lists') {
            const ok = state.publicLists.has(filters.id as string) && filters.is_public === true
            return { data: ok ? { id: filters.id } : null, error: null }
          }
          return { data: null, error: null }
        },
      }
      return q
    },
  }),
}))

vi.mock('@/lib/email/moderation', () => ({ notifyReport: (...a: unknown[]) => mockNotify(...a) }))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: (...a: unknown[]) => mockRateLimit(...a) }
})

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const LIST_ID = 'dddddddd-0000-4000-8000-000000000004'

const valid = {
  targetType: 'user',
  target: 'https://kulturaapp.vercel.app/es/u/troll',
  reason: 'harassment',
  details: 'Publica insultos en su biografía.',
  contactEmail: 'vecina@example.com',
  goodFaith: true,
  website: '',
}

function req(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/reports/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

async function post(body: unknown, ip?: string) {
  const { POST } = await import('@/app/api/reports/public/route')
  return POST(req(body, ip))
}

describe('POST /api/reports/public', () => {
  beforeEach(() => {
    inserted.length = 0
    state.insertError = null
    state.users = new Map([['troll', USER_ID]])
    state.publicLists = new Set([LIST_ID])
    mockNotify.mockReset().mockResolvedValue({ ok: true, id: 'e1' })
    mockRateLimit.mockReset().mockReturnValue({ allowed: true, retryAfterSeconds: 0, remaining: 4 })
  })
  afterEach(() => {
    delete process.env.MODERATION_V2
  })

  it('crea la denuncia sin cuenta (reporter_id nulo, contacto, sin resolved_at) y dispara el email', async () => {
    const res = await post(valid)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reference).toMatch(/^KR-[0-9A-F]{8}$/)
    expect(inserted).toEqual([
      {
        id: body.reportId,
        reporter_id: null,
        contact_email: 'vecina@example.com',
        target_type: 'user',
        target_id: USER_ID,
        reason: 'harassment: Publica insultos en su biografía.',
      },
    ])
    expect(inserted[0]).not.toHaveProperty('resolved_at')
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ reference: body.reference, stored: true, origin: 'public_form', reporterId: null }),
    )
  })

  it('límite por IP: la clave lleva la IP y un 429 corta antes de nada', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 120, remaining: 0 })
    const res = await post(valid, '198.51.100.9')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect(mockRateLimit.mock.calls[0][0]).toBe('198.51.100.9:reports_public')
    expect(inserted).toHaveLength(0)
  })

  it('trampa para bots: con `website` relleno responde 201 pero no guarda ni avisa', async () => {
    const res = await post({ ...valid, website: 'http://spam.example' })
    expect(res.status).toBe(201)
    expect(inserted).toHaveLength(0)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('exige declaración de buena fe, correo válido y detalle', async () => {
    expect((await post({ ...valid, goodFaith: false })).status).toBe(400)
    expect((await post({ ...valid, contactEmail: 'no-es-correo' })).status).toBe(400)
    const short = await post({ ...valid, details: 'corto' })
    expect(short.status).toBe(400)
    expect((await short.json()).field).toBe('details')
    expect(inserted).toHaveLength(0)
  })

  it('un perfil que no existe → 404 en el campo target', async () => {
    const res = await post({ ...valid, target: '@nadie' })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'target_not_found', field: 'target' })
  })

  it('listas: solo con MODERATION_V2 y solo si son públicas', async () => {
    const list = { ...valid, targetType: 'list', target: `/es/u/troll/l/${LIST_ID}` }
    expect((await post(list)).status).toBe(400)
    process.env.MODERATION_V2 = '1'
    expect((await post(list)).status).toBe(201)
    state.publicLists.clear()
    expect((await post(list)).status).toBe(404)
  })

  it('un mensaje no se denuncia sin cuenta (no es público)', async () => {
    process.env.MODERATION_V2 = '1'
    const res = await post({ ...valid, targetType: 'message', target: USER_ID })
    expect(res.status).toBe(400)
  })

  it('antes de la migración (reporter_id NOT NULL) no se guarda pero el email sí sale: 201 con referencia', async () => {
    state.insertError = { code: '23502', message: 'null value in column "reporter_id"' }
    const res = await post(valid)
    expect(res.status).toBe(201)
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ stored: false }))
  })

  it('sin guardar y sin email no queda constancia → 503 (no se finge)', async () => {
    state.insertError = { code: 'PGRST204', message: "Could not find the 'contact_email' column" }
    mockNotify.mockResolvedValue({ ok: false, reason: 'not_configured' })
    const res = await post(valid)
    expect(res.status).toBe(503)
  })

  it('otro error de base → 500 y sin email', async () => {
    state.insertError = { code: '08006', message: 'connection failure' }
    const res = await post(valid)
    expect(res.status).toBe(500)
    expect(mockNotify).not.toHaveBeenCalled()
  })
})
