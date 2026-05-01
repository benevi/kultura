// ============================================================
// KULTURA — Route Handlers /api/lists + /api/lists/[id] unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeRequest(body: unknown, method = 'POST', headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/lists', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const AUTH_USER = { id: 'user-001' }
const OTHER_USER = { id: 'user-002' }
const LIST_ROW = { id: 'list-001', owner_id: 'user-001', name: 'My list', media_type: 'movie', is_collaborative: false, created_at: '2024-01-01T00:00:00Z' }

const mockGetUser = vi.fn()
const mockFromLists = vi.fn()
const mockFromListItems = vi.fn()
const mockFromListMembers = vi.fn()
const mockFromUsers = vi.fn()
const mockFromNotifications = vi.fn()
const mockFromMedia = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'lists') return mockFromLists()
      if (table === 'list_items') return mockFromListItems()
      if (table === 'list_members') return mockFromListMembers()
      if (table === 'users') return mockFromUsers()
      if (table === 'notifications') return mockFromNotifications()
      if (table === 'media') return mockFromMedia()
      return {}
    }),
  }),
}))

// canEditList usa createClient también — mockeamos su import
vi.mock('@/lib/social/lists', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/social/lists')>()
  return { ...actual, canEditList: vi.fn().mockResolvedValue(true) }
})

// ── POST /api/lists ───────────────────────────────────────────────────────────

describe('POST /api/lists', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(makeRequest({ name: 'Test', mediaType: 'movie' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if name is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(makeRequest({ mediaType: 'movie' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if mediaType is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(makeRequest({ name: 'Test', mediaType: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('creates list and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromLists.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: LIST_ROW, error: null }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(makeRequest({ name: 'My list', mediaType: 'movie' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.list.id).toBe('list-001')
  })
})

// ── DELETE /api/lists ─────────────────────────────────────────────────────────

describe('DELETE /api/lists', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 if user is not the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: OTHER_USER }, error: null })
    mockFromLists.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { owner_id: 'user-001' }, error: null }),
        }),
      }),
    })
    const { DELETE } = await import('@/app/api/lists/route')
    const res = await DELETE(makeRequest({ listId: 'list-001' }, 'DELETE'))
    expect(res.status).toBe(403)
  })

  it('deletes list if user is owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromLists.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { owner_id: 'user-001' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    const { DELETE } = await import('@/app/api/lists/route')
    const res = await DELETE(makeRequest({ listId: 'list-001' }, 'DELETE'))
    expect(res.status).toBe(200)
  })
})

// ── POST /api/lists/[id] — añadir item ───────────────────────────────────────

describe('POST /api/lists/[id] — add item', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(makeRequest({ mediaId: 'movie_550' }), { params: Promise.resolve({ id: 'list-001' }) })
    expect(res.status).toBe(401)
  })

  it('returns 400 if mediaId format is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(makeRequest({ mediaId: 'invalid' }), { params: Promise.resolve({ id: 'list-001' }) })
    expect(res.status).toBe(400)
  })

  it('returns 409 if item already in list', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromListItems.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'item-001' }, error: null }),
          }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(makeRequest({ mediaId: 'movie_550' }), { params: Promise.resolve({ id: 'list-001' }) })
    expect(res.status).toBe(409)
  })

  it('adds item and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromListItems.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'item-001', list_id: 'list-001', media_id: 'movie_550', added_by: AUTH_USER.id, added_at: '2024-01-01' },
            error: null,
          }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(makeRequest({ mediaId: 'movie_550' }), { params: Promise.resolve({ id: 'list-001' }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.item.id).toBe('item-001')
  })
})
