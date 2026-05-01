// ============================================================
// KULTURA — Route Handler /api/notifications unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeRequest(body: unknown = {}, method = 'GET'): Request {
  return new Request('http://localhost/api/notifications', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
}

const AUTH_USER = { id: 'user-001' }

const NOTIF_ROW = {
  id: 'notif-001',
  user_id: 'user-001',
  type: 'recommendation' as const,
  payload: { fromUserId: 'user-002', fromUsername: 'alice', mediaId: 'movie_550', mediaTitle: 'Fight Club' },
  read_at: null,
  created_at: '2024-01-01T00:00:00Z',
}

const mockGetUser = vi.fn()
const mockFromNotifications = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'notifications') return mockFromNotifications()
      return {}
    }),
  }),
}))

// ── GET /api/notifications ────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/notifications/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns notifications and unreadCount', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromNotifications
      // first call: getNotifications
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [NOTIF_ROW], error: null }),
            }),
          }),
        }),
      })
      // second call: getUnreadCount
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        }),
      })

    const { GET } = await import('@/app/api/notifications/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0].id).toBe('notif-001')
    expect(body.unreadCount).toBe(1)
  })
})

// ── PATCH /api/notifications ──────────────────────────────────────────────────

describe('PATCH /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { PATCH } = await import('@/app/api/notifications/route')
    const res = await PATCH(makeRequest({}, 'PATCH'))
    expect(res.status).toBe(401)
  })

  it('marks all as read when no id provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFromNotifications.mockReturnValue({ update: mockUpdate })

    const { PATCH } = await import('@/app/api/notifications/route')
    const res = await PATCH(makeRequest({}, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('marks one as read when id provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockIs = vi.fn().mockResolvedValue({ error: null })
    const mockEq2 = vi.fn().mockReturnValue({ is: mockIs })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 })
    mockFromNotifications.mockReturnValue({ update: mockUpdate })

    const { PATCH } = await import('@/app/api/notifications/route')
    const res = await PATCH(makeRequest({ id: 'notif-001' }, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
