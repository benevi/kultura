// ============================================================
// KULTURA — Route Handler POST /api/groups unit tests
// Verifica auth, rate limit, validación zod y el INSERT (incl. is_public).
// Cobertura E45-c-2: is_public por defecto true; is_public:false crea privado.
// Contrato: 201 { data: Group } / { error: { code, field? } }.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { groupCreateResultSchema } from '@/lib/api/contracts/groups'

// ── Mock factories ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

// F-11: el INSERT va sin RETURNING (await directo del builder, que aquí no es
// thenable → sin error) y la fila se lee después con
// .select().eq().maybeSingle(), que resuelve { data, error }.
function buildSupabaseMock() {
  const builder: Record<string, unknown> = {}
  builder.insert = mockInsert.mockReturnValue(builder)
  builder.select = mockSelect.mockReturnValue(builder)
  builder.eq = vi.fn().mockReturnValue(builder)
  builder.single = mockSingle
  builder.maybeSingle = mockSingle
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => builder),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

// Rate limit (distribuido): por defecto permitido; un test lo fuerza a bloquear.
const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: mockRateLimit,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/groups', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const AUTH_USER = { id: '22222222-2222-4222-8222-222222222222' }
const GROUP_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: AUTH_USER.id,
  name: 'Cine',
  description: null,
  cover_color: '#E82020',
  icon: null,
  is_public: true,
  created_at: '2026-11-01T00:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    mockSingle.mockResolvedValue({ data: GROUP_ROW, error: null })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect((await res.json()).error.code).toBe('rate_limited')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid body (name too short)', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'x' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'name' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 400 invalid_json when the body is not JSON', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest('{not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_json')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // Regresión E-AVATAR-ICONS: mandar una columna que todavía no existe en la
  // base de datos es un error DURO en PostgREST, no un campo ignorado. Con la
  // migración de `groups.icon` sin aplicar, incluirla habría roto la creación
  // de grupos entera.
  it('omite icon cuando no se eligió ninguno', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Sin icono' }))
    expect(res.status).toBe(201)
    expect(mockInsert.mock.calls[0][0]).not.toHaveProperty('icon')
  })

  it('incluye icon solo cuando el usuario eligió uno', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Con icono', icon: 'robot' }))
    expect(res.status).toBe(201)
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ icon: 'robot' })
  })

  it('returns 400 when icon is not in the avatar catalog', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Con icono', icon: 'no-such-icon' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'icon' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('defaults is_public to true when omitted and returns the mapped group', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cinéfilos' }))
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith({
      id: expect.any(String),
      owner_id: AUTH_USER.id,
      name: 'Cinéfilos',
      description: null,
      cover_color: '#E82020',
      is_public: true,
    })
    const group = groupCreateResultSchema.parse((await res.json()).data)
    expect(group).toMatchObject({
      id: GROUP_ROW.id,
      ownerId: AUTH_USER.id,
      isPublic: true,
      memberRole: 'owner',
      // El color por defecto se remapea al token del tema al leer.
      coverColor: 'var(--accent-pink)',
    })
  })

  it('creates a private group when is_public:false', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Privado', is_public: false }))
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: false })
    )
  })

  it('returns 400 when is_public is not a boolean', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine', is_public: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'is_public' })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
