// ============================================================
// KULTURA — Route Handler /api/reports unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const AUTH_USER = { id: 'user-001' }

const mockGetUser = vi.fn()
const mockFromReports = vi.fn()
const mockFromUsers = vi.fn()
const mockFromMedia = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'reports') return mockFromReports()
      if (table === 'users') return mockFromUsers()
      if (table === 'media') return mockFromMedia()
      return {}
    }),
  }),
}))

describe('POST /api/reports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'media', targetId: 'movie_550' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if targetType is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'review', targetId: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if targetId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'media' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 if user reports themselves', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'user', targetId: AUTH_USER.id }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if target user does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'user', targetId: 'user-999' }))
    expect(res.status).toBe(404)
  })

  it('creates report and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    // mock existencia del target media
    mockFromMedia.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'movie_550' }, error: null }),
        }),
      }),
    })
    mockFromReports.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'report-001' }, error: null }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/reports/route')
    const res = await POST(makeRequest({ targetType: 'media', targetId: 'movie_550', reason: 'Spam' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reportId).toBe('report-001')
  })
})
