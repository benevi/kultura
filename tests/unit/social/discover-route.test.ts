// ============================================================
// KULTURA — Route Handler GET /api/groups/discover unit tests
// Verifica auth, validación zod, paso de params al RPC y mapeo de filas.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock factories ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  }),
}))

// Rate limit: por defecto permitido; un test concreto lo fuerza a bloquear.
const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(query = ''): NextRequest {
  const url = `http://localhost/api/groups/discover${query ? `?${query}` : ''}`
  return new NextRequest(url, { method: 'GET' })
}

const AUTH_USER = { id: 'user-001' }

const RPC_ROW = {
  id: 'group-001',
  owner_id: 'user-002',
  name: 'Cinéfilos',
  description: 'Grupo de cine',
  cover_color: '#E82020',
  created_at: '2026-01-01T00:00:00Z',
  member_count: 12,
  is_member: false,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/groups/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid scope', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('scope=bogus'))
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 on negative offset', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('offset=-5'))
    expect(res.status).toBe(400)
  })

  it('passes default params to the RPC when query is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('get_discoverable_groups', {
      p_q: null,
      p_scope: 'all',
      p_size: 'all',
      p_limit: 50,
      p_offset: 0,
    })
  })

  it('forwards search/scope/size/pagination params to the RPC', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('q=cine&scope=unjoined&size=medium&limit=10&offset=20'))
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('get_discoverable_groups', {
      p_q: 'cine',
      p_scope: 'unjoined',
      p_size: 'medium',
      p_limit: 10,
      p_offset: 20,
    })
  })

  it('maps RPC rows into camelCase DiscoverGroup shape', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({ data: [RPC_ROW], error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('q=cine'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0]).toEqual({
      id: 'group-001',
      ownerId: 'user-002',
      name: 'Cinéfilos',
      description: 'Grupo de cine',
      coverColor: '#E82020',
      createdAt: '2026-01-01T00:00:00Z',
      memberCount: 12,
      isMember: false,
    })
  })

  it('coerces member_count from string and null is_member to false', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({
      data: [{ ...RPC_ROW, member_count: '7', is_member: null }],
      error: null,
    })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.groups[0].memberCount).toBe(7)
    expect(body.groups[0].isMember).toBe(false)
  })

  it('caps limit at 50 (zod max)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('limit=500'))
    expect(res.status).toBe(400)
  })
})
