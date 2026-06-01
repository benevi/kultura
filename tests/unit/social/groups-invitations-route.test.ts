// ============================================================
// KULTURA — Route Handler /api/groups/[id]/invitations unit tests
// POST: owner-only, friend-only, dup pending, ya-miembro, happy path.
// GET:  owner-only listado de amigos invitables.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const GROUP_ID = 'group-001'

// ── Per-table supabase mock ─────────────────────────────────────────────────

const mockGetUser = vi.fn()
// Cada test inyecta el handler de tabla que necesite.
const tableHandlers: Record<string, () => unknown> = {}

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => (tableHandlers[table] ? tableHandlers[table]() : {})),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

const mockGetGroupById = vi.fn()
const mockIsGroupOwner = vi.fn()
const mockIsGroupMember = vi.fn()
const mockGetInvitableFriends = vi.fn()

vi.mock('@/lib/social/groups', () => ({
  getGroupById: (...a: unknown[]) => mockGetGroupById(...a),
  isGroupOwner: (...a: unknown[]) => mockIsGroupOwner(...a),
  isGroupMember: (...a: unknown[]) => mockIsGroupMember(...a),
  getInvitableFriends: (...a: unknown[]) => mockGetInvitableFriends(...a),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function postReq(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${GROUP_ID}/invitations`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function ctx() {
  return { params: Promise.resolve({ id: GROUP_ID }) }
}

const AUTH_USER = { id: 'owner-001' }
const INVITEE_ID = 'friend-002'
const GROUP = { id: GROUP_ID, name: 'Film Club', ownerId: AUTH_USER.id }

// friendships builder: select().eq().or().limit().maybeSingle()
function friendshipsReturning(data: unknown) {
  return () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        or: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  })
}

// group_invitations builder: select().eq().eq().eq().maybeSingle() (dup check)
//                       y    insert().select().single()
function invitationsBuilder(opts: { existingPending?: unknown; inserted?: unknown }) {
  return () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.existingPending ?? null, error: null }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: opts.inserted ?? null, error: opts.inserted ? null : { message: 'fail' } }),
      }),
    }),
  })
}

// users / notifications: builders inertes para no romper llamadas best-effort
function usersBuilder() {
  return () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { username: 'owner' }, error: null }),
      }),
    }),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(tableHandlers)) delete tableHandlers[k]
  mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
})

// ── POST ──────────────────────────────────────────────────────────────────

describe('POST /api/groups/[id]/invitations', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(401)
  })

  it('returns 400 if inviteeId missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({}), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 400 if inviting yourself', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: AUTH_USER.id }), ctx())
    expect(res.status).toBe(400)
  })

  it('returns 404 if group does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(null)
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(404)
  })

  it('returns 403 if caller is not owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockIsGroupOwner.mockResolvedValue(false)
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(403)
  })

  it('returns 403 if invitee is not a friend', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockIsGroupOwner.mockResolvedValue(true)
    tableHandlers.friendships = friendshipsReturning(null)
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(403)
  })

  it('returns 409 if invitee is already a member', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockIsGroupOwner.mockResolvedValue(true)
    mockIsGroupMember.mockResolvedValue(true)
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(409)
  })

  it('returns 409 if a pending invitation already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockIsGroupOwner.mockResolvedValue(true)
    mockIsGroupMember.mockResolvedValue(false)
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    tableHandlers.group_invitations = invitationsBuilder({ existingPending: { id: 'inv-old' } })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(409)
  })

  it('creates invitation + notification and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    mockIsGroupOwner.mockResolvedValue(true)
    mockIsGroupMember.mockResolvedValue(false)
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    const INSERTED = {
      id: 'inv-001',
      group_id: GROUP_ID,
      inviter_id: AUTH_USER.id,
      invitee_id: INVITEE_ID,
      status: 'pending',
      created_at: '2026-06-01T00:00:00Z',
    }
    tableHandlers.group_invitations = invitationsBuilder({ inserted: INSERTED })
    const notifInsert = vi.fn().mockResolvedValue({ error: null })
    tableHandlers.users = usersBuilder()
    tableHandlers.notifications = () => ({ insert: notifInsert })

    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.invitation.id).toBe('inv-001')
    expect(notifInsert).toHaveBeenCalledOnce()
    const notifArg = notifInsert.mock.calls[0][0]
    expect(notifArg.type).toBe('group_invite')
    expect(notifArg.user_id).toBe(INVITEE_ID)
    expect(notifArg.payload.invitationId).toBe('inv-001')
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(429)
  })
})

// ── GET ──────────────────────────────────────────────────────────────────

describe('GET /api/groups/[id]/invitations', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 403 if caller is not owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockIsGroupOwner.mockResolvedValue(false)
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx())
    expect(res.status).toBe(403)
  })

  it('returns invitable friends for the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockIsGroupOwner.mockResolvedValue(true)
    mockGetInvitableFriends.mockResolvedValue([
      { id: INVITEE_ID, username: 'bob', avatarColor: '#fff', avatarInitials: 'BO' },
    ])
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.friends).toHaveLength(1)
  })
})
