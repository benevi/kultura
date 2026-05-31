// ============================================================
// KULTURA — Route Handler GET /api/groups/discover unit tests
// Verifica auth, validación zod, query directa PostgREST y filtros JS
// (scope/size/q/paginación) sobre el join anidado group_members.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock factories ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockOrder = vi.fn()
const mockIlike = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

// Builder encadenable: .select().order().ilike() devuelven el mismo builder,
// que es awaitable (thenable) y resuelve { data, error }. La data se controla
// con `queryResult`.
let queryResult: { data: unknown; error: unknown } = { data: [], error: null }

function makeBuilder() {
  const builder: Record<string, unknown> = {}
  builder.select = mockSelect.mockReturnValue(builder)
  builder.order = mockOrder.mockReturnValue(builder)
  builder.ilike = mockIlike.mockReturnValue(builder)
  builder.then = (resolve: (v: typeof queryResult) => unknown) => resolve(queryResult)
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom.mockImplementation(() => makeBuilder()),
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

/** Fila cruda de groups con join anidado group_members. */
function groupRow(
  id: string,
  memberUserIds: string[],
  overrides: Partial<{
    owner_id: string
    name: string
    description: string | null
    cover_color: string
    created_at: string
  }> = {}
) {
  return {
    id,
    owner_id: overrides.owner_id ?? 'user-002',
    name: overrides.name ?? `Grupo ${id}`,
    description: overrides.description ?? null,
    cover_color: overrides.cover_color ?? '#E82020',
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    group_members: memberUserIds.map((user_id) => ({ user_id })),
  }
}

function setRows(rows: unknown[]) {
  queryResult = { data: rows, error: null }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/groups/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    queryResult = { data: [], error: null }
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid scope', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('scope=bogus'))
    expect(res.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
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

  it('queries groups with nested group_members and orders by created_at desc', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('groups')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, owner_id, name, description, cover_color, created_at, group_members(user_id)'
    )
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    // Sin q → sin ilike.
    expect(mockIlike).not.toHaveBeenCalled()
  })

  it('applies ilike on name when q is present', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('q=cine'))
    expect(res.status).toBe(200)
    expect(mockIlike).toHaveBeenCalledWith('name', '%cine%')
  })

  it('derives memberCount/isMember and maps to camelCase DiscoverGroup', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([
      groupRow('group-001', ['user-002', 'user-003'], {
        owner_id: 'user-002',
        name: 'Cinéfilos',
        description: 'Grupo de cine',
        cover_color: '#E82020',
        created_at: '2026-01-01T00:00:00Z',
      }),
    ])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
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
      memberCount: 2,
      isMember: false,
    })
  })

  it('sets isMember true when the caller is in group_members', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([groupRow('group-001', ['user-001', 'user-002'])])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.groups[0].isMember).toBe(true)
    expect(body.groups[0].memberCount).toBe(2)
  })

  it('scope=joined keeps only groups the caller belongs to', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([
      groupRow('g-joined', ['user-001']),
      groupRow('g-other', ['user-002']),
    ])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('scope=joined'))
    const body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-joined'])
  })

  it('scope=unjoined drops groups the caller belongs to', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([
      groupRow('g-joined', ['user-001']),
      groupRow('g-other', ['user-002']),
    ])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('scope=unjoined'))
    const body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-other'])
  })

  it('size buckets filter by member count', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const small = groupRow('g-small', Array.from({ length: 5 }, (_, i) => `u${i}`))
    const medium = groupRow('g-medium', Array.from({ length: 20 }, (_, i) => `u${i}`))
    const large = groupRow('g-large', Array.from({ length: 60 }, (_, i) => `u${i}`))
    setRows([small, medium, large])

    const { GET } = await import('@/app/api/groups/discover/route')

    let res = await GET(makeRequest('size=small'))
    let body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-small'])

    res = await GET(makeRequest('size=medium'))
    body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-medium'])

    res = await GET(makeRequest('size=large'))
    body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-large'])
  })

  it('orders by member count desc then created_at desc', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    setRows([
      groupRow('g-few', ['u1'], { created_at: '2026-03-01T00:00:00Z' }),
      groupRow('g-many', ['u1', 'u2', 'u3'], { created_at: '2026-01-01T00:00:00Z' }),
      groupRow('g-mid-new', ['u1', 'u2'], { created_at: '2026-05-01T00:00:00Z' }),
    ])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-many', 'g-mid-new', 'g-few'])
  })

  it('paginates with offset/limit after filtering', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    // 3 grupos con member counts 3,2,1 → orden desc por count.
    setRows([
      groupRow('g-a', ['u1', 'u2', 'u3']),
      groupRow('g-b', ['u1', 'u2']),
      groupRow('g-c', ['u1']),
    ])

    const { GET } = await import('@/app/api/groups/discover/route')
    const res = await GET(makeRequest('limit=1&offset=1'))
    const body = await res.json()
    expect(body.groups.map((g: { id: string }) => g.id)).toEqual(['g-b'])
  })
})
