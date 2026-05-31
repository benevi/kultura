// ============================================================
// KULTURA — Route Handler /api/groups/[id]/join unit tests
// Verifica auth, join (insert role='member') y leave.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GROUP_ID = 'group-001'

function makeRequest(): Request {
  return new Request(`http://localhost/api/groups/${GROUP_ID}/join`, { method: 'POST' })
}

function makeContext() {
  return { params: Promise.resolve({ id: GROUP_ID }) }
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

vi.mock('@/lib/social/groups', () => ({
  getGroupById: (...args: unknown[]) => mockGetGroupById(...args),
  getMemberRole: (...args: unknown[]) => mockGetMemberRole(...args),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { id: 'user-001' }
const GROUP = { id: GROUP_ID, name: 'Film Club', owner_id: 'owner-xyz' }

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
  })

  it('returns 404 if group does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(null)

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(404)
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
    expect(body.joined).toBe(true)

    // payload must satisfy the RLS WITH CHECK: user_id = auth.uid() AND role = 'member'
    expect(mockInsert).toHaveBeenCalledWith({
      group_id: GROUP_ID,
      user_id: AUTH_USER.id,
      role: 'member',
    })
  })

  it('owner cannot leave: returns 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockGetMemberRole.mockResolvedValue('owner')

    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(makeRequest() as never, makeContext())
    expect(res.status).toBe(400)
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
    expect(body.joined).toBe(false)
  })
})
