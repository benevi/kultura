// ============================================================
// KULTURA — Route Handler POST /api/groups unit tests
// Verifica auth, rate limit, validación zod y el INSERT (incl. is_public).
// Cobertura E45-c-2: is_public por defecto true; is_public:false crea privado.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock factories ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

// Cadena .insert().select().single(): insert y select devuelven el builder,
// single resuelve { data, error }.
function buildSupabaseMock() {
  const builder: Record<string, unknown> = {}
  builder.insert = mockInsert.mockReturnValue(builder)
  builder.select = mockSelect.mockReturnValue(builder)
  builder.single = mockSingle
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => builder),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

// Rate limit: por defecto permitido; un test lo fuerza a bloquear.
const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/groups', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const AUTH_USER = { id: 'user-001' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    mockSingle.mockResolvedValue({ data: { id: 'group-001' }, error: null })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine' }))
    expect(res.status).toBe(401)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 60 })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid body (name too short)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'x' }))
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('defaults is_public to true when omitted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cinéfilos' }))
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith({
      owner_id: AUTH_USER.id,
      name: 'Cinéfilos',
      description: null,
      cover_color: '#E82020',
      is_public: true,
    })
  })

  it('creates a private group when is_public:false', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Privado', is_public: false }))
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: false })
    )
  })

  it('returns 400 when is_public is not a boolean', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Cine', is_public: 'nope' }))
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
