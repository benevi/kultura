// ============================================================
// KULTURA — Route Handler /api/friends unit tests
// Verifica autenticación, validación y operaciones POST/PATCH/DELETE.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { friendRequestResultSchema, friendRespondResultSchema } from '@/lib/api/contracts/friends'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/friends', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Mock factories ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockFromUsers = vi.fn()
const mockFromFriendships = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'users') return mockFromUsers()
      if (table === 'friendships') return mockFromFriendships()
      return {}
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimitDistributed: async () => mockCheckRateLimit() }
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { id: '00000000-0000-4000-8000-000000000001' }
const RECEIVER_ID = '00000000-0000-4000-8000-000000000002'
const FRIENDSHIP_ROW = {
  id: 'friendship-001',
  requester_id: '00000000-0000-4000-8000-000000000001',
  receiver_id: '00000000-0000-4000-8000-000000000002',
  status: 'pending',
  created_at: '2024-01-01T00:00:00Z',
}

// ── POST /api/friends ─────────────────────────────────────────────────────────

describe('POST /api/friends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: RECEIVER_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if receiverId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatchObject({ code: 'invalid_input', field: 'receiverId' })
  })

  it('returns 400 if sending request to self', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: AUTH_USER.id }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('yourself')
  })

  it('returns 404 if receiver does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: RECEIVER_ID }))
    expect(res.status).toBe(404)
  })

  it('returns 409 if friendship already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: FRIENDSHIP_ROW, error: null }),
        }),
      }),
    })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: RECEIVER_ID }))
    expect(res.status).toBe(409)
  })

  it('creates friendship and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: FRIENDSHIP_ROW, error: null }),
        }),
      }),
    })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: RECEIVER_ID }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(friendRequestResultSchema.parse(body.data).id).toBe('friendship-001')
  })

  it('saneamiento 3.1: si la otra persona la mandó a la vez (23505) → 409, no 500', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
        }),
      }),
    })

    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(makeRequest({ receiverId: RECEIVER_ID }))
    expect(res.status).toBe(409)
  })
})

// ── PATCH /api/friends ────────────────────────────────────────────────────────

describe('PATCH /api/friends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { PATCH } = await import('@/app/api/friends/route')
    const res = await PATCH(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333', action: 'accept' }, 'PATCH'))
    expect(res.status).toBe(401)
  })

  it('returns 400 if action is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { PATCH } = await import('@/app/api/friends/route')
    const res = await PATCH(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333', action: 'invalid' }, 'PATCH'))
    expect(res.status).toBe(400)
  })

  it('returns 403 if user is not the receiver', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: '33333333-3333-4333-8333-333333333333', receiver_id: 'other-user', status: 'pending' },
            error: null,
          }),
        }),
      }),
    })

    const { PATCH } = await import('@/app/api/friends/route')
    const res = await PATCH(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333', action: 'accept' }, 'PATCH'))
    expect(res.status).toBe(403)
  })

  it('accepts a pending request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const PENDING_FRIENDSHIP = { id: '33333333-3333-4333-8333-333333333333', receiver_id: AUTH_USER.id, status: 'pending' }
    const ACCEPTED = { ...FRIENDSHIP_ROW, status: 'accepted' }

    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: PENDING_FRIENDSHIP, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: ACCEPTED, error: null }),
          }),
        }),
      }),
    })

    const { PATCH } = await import('@/app/api/friends/route')
    const res = await PATCH(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333', action: 'accept' }, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(friendRespondResultSchema.parse(body.data)?.status).toBe('accepted')
  })

  it('returns 429 when rate limited (E99)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })

    const { PATCH } = await import('@/app/api/friends/route')
    const res = await PATCH(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333', action: 'accept' }, 'PATCH'))
    expect(res.status).toBe(429)
  })
})

// ── DELETE /api/friends ───────────────────────────────────────────────────────

describe('DELETE /api/friends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { DELETE } = await import('@/app/api/friends/route')
    const res = await DELETE(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333' }, 'DELETE'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user is not a participant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: '33333333-3333-4333-8333-333333333333', requester_id: 'other-a', receiver_id: 'other-b' },
            error: null,
          }),
        }),
      }),
    })

    const { DELETE } = await import('@/app/api/friends/route')
    const res = await DELETE(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333' }, 'DELETE'))
    expect(res.status).toBe(403)
  })

  it('deletes friendship if user is requester', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromFriendships.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: '33333333-3333-4333-8333-333333333333', requester_id: AUTH_USER.id, receiver_id: RECEIVER_ID },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const { DELETE } = await import('@/app/api/friends/route')
    const res = await DELETE(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333' }, 'DELETE'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: null })
  })

  it('returns 429 when rate limited (E99)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })

    const { DELETE } = await import('@/app/api/friends/route')
    const res = await DELETE(makeRequest({ friendshipId: '33333333-3333-4333-8333-333333333333' }, 'DELETE'))
    expect(res.status).toBe(429)
  })
})
