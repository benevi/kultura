// ============================================================
// KULTURA — Route Handler /api/account/export unit tests (D3)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockProfileSingle,
        })),
      })),
    })),
  }),
}))

const mockGetUserMedia = vi.fn()
vi.mock('@/lib/library/queries', () => ({ getUserMedia: (...a: unknown[]) => mockGetUserMedia(...a) }))

const mockGetUserLists = vi.fn()
const mockGetListDetail = vi.fn()
vi.mock('@/lib/social/lists', () => ({
  getUserLists: (...a: unknown[]) => mockGetUserLists(...a),
  getListDetail: (...a: unknown[]) => mockGetListDetail(...a),
}))

const mockGetFriends = vi.fn()
vi.mock('@/lib/social/friends', () => ({ getFriends: (...a: unknown[]) => mockGetFriends(...a) }))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

const AUTH_USER = { id: 'user-001', email: 'user@example.com' }
const PROFILE_ROW = {
  username: 'alice',
  bio: null,
  avatar_color: '#E82020',
  avatar_initials: 'AL',
  preferred_locale: 'es',
  created_at: '2024-01-01T00:00:00Z',
}

describe('GET /api/account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(429)
  })

  it('returns profile + library + lists + friendships for the authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([{ id: 'um-1' }])
    mockGetUserLists.mockResolvedValue([{ id: 'list-1' }])
    mockGetFriends.mockResolvedValue([{ friendshipId: 'f-1' }])

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.username).toBe('alice')
    expect(body.profile.email).toBe(AUTH_USER.email)
    expect(body.library).toEqual([{ id: 'um-1' }])
    // `items` se añade siempre: una lista ajena (sin owner propio) va vacía.
    expect(body.lists).toEqual([{ id: 'list-1', items: [] }])
    expect(body.friendships).toEqual([{ friendshipId: 'f-1' }])
    expect(typeof body.exportedAt).toBe('string')
    expect(mockGetUserMedia).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockGetUserLists).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockGetFriends).toHaveBeenCalledWith(AUTH_USER.id)
  })

  // Sin esto el export guardaba listas VACÍAS y reimportarlas no reconstruía
  // nada (ver /api/account/import).
  it('incluye el contenido de las listas propias', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([])
    mockGetUserLists.mockResolvedValue([
      { id: 'list-1', name: 'Pendientes', owner: { id: AUTH_USER.id } },
      { id: 'list-2', name: 'De otro', owner: { id: 'user-999' } },
    ])
    mockGetFriends.mockResolvedValue([])
    mockGetListDetail.mockResolvedValue({
      items: [{ mediaId: 'movie_550' }, { mediaId: 'game_1' }],
    })

    const { GET } = await import('@/app/api/account/export/route')
    const body = await (await GET()).json()

    expect(body.lists[0].items).toEqual(['movie_550', 'game_1'])
    // La lista ajena no se recorre: no es del usuario y no le toca recuperarla.
    expect(body.lists[1].items).toEqual([])
    expect(mockGetListDetail).toHaveBeenCalledTimes(1)
  })

  it('si falla el detalle de una lista, el export sigue adelante sin su contenido', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([])
    mockGetUserLists.mockResolvedValue([
      { id: 'list-1', name: 'Pendientes', owner: { id: AUTH_USER.id } },
    ])
    mockGetFriends.mockResolvedValue([])
    mockGetListDetail.mockRejectedValue(new Error('boom'))

    const res = await (await import('@/app/api/account/export/route')).GET()

    expect(res.status).toBe(200)
    expect((await res.json()).lists[0].items).toEqual([])
  })

  it('returns 500 if the profile lookup fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 500 if any of the data queries throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockRejectedValue(new Error('db down'))
    mockGetUserLists.mockResolvedValue([])
    mockGetFriends.mockResolvedValue([])

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
