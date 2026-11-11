// ============================================================
// KULTURA — Route Handler /api/groups/[id]/join unit tests
// Verifica auth, join (insert role='member') y leave.
// Contrato: { data: { joined } } / { error: { code, message? } }.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { joinResultSchema, GROUP_ERRORS } from '@/lib/api/contracts/groups'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GROUP_ID = '11111111-1111-4111-8111-111111111111'

function makeRequest(): Request {
  return new Request(`http://localhost/api/groups/${GROUP_ID}/join`, { method: 'POST' })
}

function makeContext(id = GROUP_ID) {
  return { params: Promise.resolve({ id }) }
}

// ── Mock factories ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockGetGroupById = vi.fn()
const mockGetMemberRole = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      insert: mockInsert,
      delete: mockDelete,
    })),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

vi.mock('@/lib/social/groups', () => ({
  getGroupById: (...args: unknown[]) => mockGetGroupById(...args),
  getMemberRole: (...args: unknown[]) => mockGetMemberRole(...args),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { id: '22222222-2222-4222-8222-222222222222' }
const GROUP = { id: GROUP_ID, name: 'Film Club', owner_id: '33333333-3333-4333-8333-333333333333' }

// ── POST /api/groups/[id]/join ──────────────────────────────────────────────────

describe('POST /api/groups/[id]/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
  })

  it('returns 404 if group does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(null)

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 404 if the id is not a uuid (no DB access)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext('not-a-uuid'))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
    expect(mockGetGroupById).not.toHaveBeenCalled()
  })

  it('joins as member: inserts user_id=auth.uid() role=member and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockGetMemberRole.mockResolvedValue(null) // not yet a member
    mockInsert.mockResolvedValue({ error: null })

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(joinResultSchema.parse(body.data).joined).toBe(true)

    // payload must satisfy the RLS WITH CHECK: user_id = auth.uid() AND role = 'member'
    expect(mockInsert).toHaveBeenCalledWith({
      group_id: GROUP_ID,
      user_id: AUTH_USER.id,
      role: 'member',
    })
  })

  it('owner cannot leave: returns 403 owner_cannot_leave', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockGetMemberRole.mockResolvedValue('owner')

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'forbidden', message: GROUP_ERRORS.ownerCannotLeave })
  })

  it('member leaves: deletes own row and returns joined=false', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockGetMemberRole.mockResolvedValue('member')
    mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(joinResultSchema.parse(body.data).joined).toBe(false)
  })
})
