// ============================================================
// KULTURA — Route Handler GET /api/groups/discover unit tests
// Verifica auth, validación zod, los argumentos del RPC discover_groups y el
// mapeo a DiscoverGroup. Filtros, orden y página van en SQL (saneamiento
// 6.4) y se prueban en tests/integration/groups/discover.test.ts.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { discoverResultSchema } from '@/lib/api/contracts/groups'

// ── Mock factories ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()

let rpcResult: { data: unknown; error: unknown } = { data: [], error: null }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc.mockImplementation(async () => rpcResult),
    from: mockFrom,
  }),
}))

// Rate limit (distribuido): por defecto permitido; un test concreto lo fuerza a bloquear.
const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: mockRateLimit,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(query = ''): NextRequest {
  const url = `http://localhost/api/groups/discover${query ? `?${query}` : ''}`
  return new NextRequest(url, { method: 'GET' })
}

const AUTH_USER = { id: 'user-001' }

/** Fila del RPC discover_groups. */
function rpcRow(
  id: string,
  overrides: Partial<{
    owner_id: string
    name: string
    description: string | null
    cover_color: string
    icon: string | null
    created_at: string
    member_count: number
    is_member: boolean
  }> = {}
) {
  return {
    id,
    owner_id: overrides.owner_id ?? 'user-002',
    name: overrides.name ?? `Grupo ${id}`,
    description: overrides.description ?? null,
    cover_color: overrides.cover_color ?? '#E82020',
    icon: overrides.icon ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    member_count: overrides.member_count ?? 1,
    is_member: overrides.is_member ?? false,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/groups/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    rpcResult = { data: [], error: null }
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
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect((await res.json()).error.code).toBe('rate_limited')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid scope', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('scope=bogus'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'scope' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns 400 on negative offset', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('offset=-5'))
    expect(res.status).toBe(400)
  })

  it('caps limit at 50 (zod max)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('limit=500'))
    expect(res.status).toBe(400)
  })

  it('makes one RPC call with defaults and no table queries', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('discover_groups', {
      p_q: undefined,
      p_scope: 'all',
      p_size: 'all',
      p_limit: 50,
      p_offset: 0,
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('passes q (trimmed, literal), scope, size, limit and offset to SQL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('q=%20cine%25%20&scope=unjoined&size=small&limit=10&offset=20'))
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('discover_groups', {
      p_q: 'cine%',
      p_scope: 'unjoined',
      p_size: 'small',
      p_limit: 10,
      p_offset: 20,
    })
  })

  it('maps RPC rows to camelCase DiscoverGroup, keeping SQL order', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    rpcResult = {
      data: [
        rpcRow('group-001', {
          name: 'Cinéfilos',
          description: 'Grupo de cine',
          member_count: 2,
          is_member: true,
          icon: 'film',
        }),
        rpcRow('group-002', { cover_color: '#123456' }),
      ],
      error: null,
    }

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const groups = discoverResultSchema.parse((await res.json()).data)
    expect(groups.map((g) => g.id)).toEqual(['group-001', 'group-002'])
    expect(groups[0]).toEqual({
      id: 'group-001',
      ownerId: 'user-002',
      name: 'Cinéfilos',
      description: 'Grupo de cine',
      // Rojo legacy remapeado al leer.
      coverColor: 'var(--accent-pink)',
      icon: 'film',
      createdAt: '2026-01-01T00:00:00Z',
      memberCount: 2,
      isMember: true,
    })
    expect(groups[1]).toMatchObject({ coverColor: '#123456', icon: null, memberCount: 1, isMember: false })
  })

  it('returns 500 when the RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    rpcResult = { data: null, error: { message: 'boom' } }

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
