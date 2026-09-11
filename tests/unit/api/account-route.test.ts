// ============================================================
// KULTURA — Route Handler /api/account unit tests (D2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

const mockDeleteUser = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: mockDeleteUser } } }),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

const AUTH_USER = { id: 'user-001' }

describe('DELETE /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(401)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(429)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('deletes the authenticated user via the admin client and returns ok', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })

    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()

    expect(mockDeleteUser).toHaveBeenCalledWith(AUTH_USER.id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 500 if the admin delete fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockDeleteUser.mockResolvedValue({ error: { message: 'boom' } })

    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(500)
  })
})
