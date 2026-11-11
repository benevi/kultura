// ============================================================
// KULTURA — Route Handler /api/groups/[id]/invitations unit tests
// POST: owner-only, friend-only, dup pending, ya-miembro, happy path.
// GET:  owner-only listado de amigos invitables.
// Contrato: { data } / { error: { code, message?, field? } }.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GROUP_ERRORS, invitableFriendsSchema, invitationSchema } from '@/lib/api/contracts/groups'

const GROUP_ID = '11111111-1111-4111-8111-111111111111'

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
const mockGetMemberRole = vi.fn()
const mockGetInvitableFriends = vi.fn()

vi.mock('@/lib/social/groups', () => ({
  getGroupById: (...a: unknown[]) => mockGetGroupById(...a),
  getMemberRole: (...a: unknown[]) => mockGetMemberRole(...a),
  getInvitableFriends: (...a: unknown[]) => mockGetInvitableFriends(...a),
}))

const { mockRateLimit } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: mockRateLimit,
}))

// E83: la notif se inserta vía admin client (service-role), no vía el server client.
const mockAdminNotifInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) =>
      table === 'notifications' ? { insert: mockAdminNotifInsert } : {}
    ),
  }),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function postReq(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${GROUP_ID}/invitations`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function ctx(id = GROUP_ID) {
  return { params: Promise.resolve({ id }) }
}

const AUTH_USER = { id: '22222222-2222-4222-8222-222222222222' }
const INVITEE_ID = '33333333-3333-4333-8333-333333333333'
const INVITATION_ID = '44444444-4444-4444-8444-444444444444'
const GROUP = { id: GROUP_ID, name: 'Film Club', ownerId: AUTH_USER.id }

/** Rol del que llama y del invitado en el grupo (getMemberRole). */
function roles(caller: string | null, invitee: string | null = null) {
  mockGetMemberRole.mockImplementation(async (_groupId: string, userId: string) =>
    userId === AUTH_USER.id ? caller : invitee
  )
}

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
  mockRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  mockAdminNotifInsert.mockResolvedValue({ error: null })
  mockGetMemberRole.mockReset()
})

// ── POST ──────────────────────────────────────────────────────────────────

describe('POST /api/groups/[id]/invitations', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
  })

  it('returns 400 if inviteeId missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({}), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'inviteeId' })
  })

  it('returns 400 if inviteeId is not a uuid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: 'friend-002' }), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'inviteeId' })
  })

  it('returns 400 invalid_json when the body is not JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq('{'), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_json')
  })

  it('returns 400 if inviting yourself', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: AUTH_USER.id }), ctx())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toEqual({
      code: 'invalid_input',
      message: GROUP_ERRORS.cannotInviteSelf,
      field: 'inviteeId',
    })
  })

  it('returns 404 if the group id is not a uuid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx('group-001'))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
    expect(mockGetGroupById).not.toHaveBeenCalled()
  })

  it('returns 404 if group does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(null)
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 403 if caller is not owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    roles('member')
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('returns 403 if invitee is not a friend', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    roles('owner')
    tableHandlers.friendships = friendshipsReturning(null)
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(403)
    expect((await res.json()).error).toEqual({ code: 'forbidden', message: GROUP_ERRORS.notFriends })
  })

  it('returns 409 if invitee is already a member', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    roles('owner', 'member')
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'conflict', message: GROUP_ERRORS.alreadyMember })
  })

  it('returns 409 if a pending invitation already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    roles('owner', null)
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    tableHandlers.group_invitations = invitationsBuilder({ existingPending: { id: 'inv-old' } })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'conflict', message: GROUP_ERRORS.invitationPending })
  })

  it('creates invitation + notification and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetGroupById.mockResolvedValue(GROUP)
    roles('owner', null)
    tableHandlers.friendships = friendshipsReturning({ id: 'f-1' })
    const INSERTED = {
      id: INVITATION_ID,
      group_id: GROUP_ID,
      inviter_id: AUTH_USER.id,
      invitee_id: INVITEE_ID,
      status: 'pending',
      created_at: '2026-06-01T00:00:00Z',
    }
    tableHandlers.group_invitations = invitationsBuilder({ inserted: INSERTED })
    tableHandlers.users = usersBuilder()

    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(invitationSchema.parse(body.data)).toEqual({
      id: INVITATION_ID,
      groupId: GROUP_ID,
      inviterId: AUTH_USER.id,
      inviteeId: INVITEE_ID,
      status: 'pending',
      createdAt: '2026-06-01T00:00:00Z',
    })
    // E83: notif insertada vía admin client (service-role)
    expect(mockAdminNotifInsert).toHaveBeenCalledOnce()
    const notifArg = mockAdminNotifInsert.mock.calls[0][0]
    expect(notifArg.type).toBe('group_invite')
    expect(notifArg.user_id).toBe(INVITEE_ID)
    expect(notifArg.payload.invitationId).toBe(INVITATION_ID)
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 })
    const { POST } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await POST(postReq({ inviteeId: INVITEE_ID }), ctx())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect((await res.json()).error.code).toBe('rate_limited')
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

  it('returns 404 if the group id is not a uuid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx('group-001'))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 403 if caller is not owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    roles('member')
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('returns invitable friends for the owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    roles('owner')
    mockGetInvitableFriends.mockResolvedValue([
      { id: INVITEE_ID, username: 'bob', avatarColor: '#fff', avatarInitials: 'BO' },
    ])
    const { GET } = await import('@/app/api/groups/[id]/invitations/route')
    const res = await GET({} as never, ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    const friends = invitableFriendsSchema.parse(body.data)
    expect(friends).toHaveLength(1)
    expect(friends[0].id).toBe(INVITEE_ID)
  })
})
