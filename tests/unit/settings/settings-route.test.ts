// ============================================================
// KULTURA — /api/settings unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const AUTH_USER = { id: 'user-001', email: 'test@example.com' }

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns user settings for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { username: 'testuser', avatar_color: 'blue', preferred_locale: 'es' },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    })

    const { GET } = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.username).toBe('testuser')
    expect(body.avatar_color).toBe('blue')
  })
})

describe('PATCH /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'newname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })

  it('updates username successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { username: 'newname', avatar_color: 'blue', preferred_locale: 'es' },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      update: vi.fn().mockReturnThis(),
      single: mockSingle,
    })

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'newname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 for username with special characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'invalid name!' }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 409 if username is already taken', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'other-user' }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'takenname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('username_taken')
  })

  it('returns 400 for invalid avatar_color', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ avatar_color: '#ff0000' }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })
})
