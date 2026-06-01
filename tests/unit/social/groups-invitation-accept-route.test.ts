// ============================================================
// KULTURA — Route Handler /api/groups/invitations/[invitationId] unit tests
// PATCH: aceptar (invitee-only, trigger da el alta), DELETE: rechazar.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const INVITATION_ID = 'inv-001'

const mockGetUser = vi.fn()
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

function ctx() {
  return { params: Promise.resolve({ invitationId: INVITATION_ID }) }
}

const AUTH_USER = { id: 'invitee-001' }

// group_invitations: select().eq().maybeSingle() para cargar la fila
function loadInvitation(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

// notifications: update().eq().eq().eq() y delete().eq().eq().eq() — inertes
function notificationsBuilder() {
  const chain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    }),
  }
  return () => chain
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(tableHandlers)) delete tableHandlers[k]
})

// ── PATCH (accept) ───────────────────────────────────────────────────────

describe('PATCH /api/groups/invitations/[invitationId]', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 404 if invitation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () => loadInvitation(null)
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(404)
  })

  it('returns 403 if caller is not the invitee', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, invitee_id: 'someone-else', status: 'pending' })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(403)
  })

  it('returns 409 if invitation is not pending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, invitee_id: AUTH_USER.id, status: 'accepted' })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(409)
  })

  it('accepts: updates status and returns ok (trigger inserts member)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const updateEq2 = vi.fn().mockResolvedValue({ error: null, count: 1 })
    tableHandlers.group_invitations = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INVITATION_ID, invitee_id: AUTH_USER.id, status: 'pending' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: updateEq2 }),
      }),
    })
    tableHandlers.notifications = notificationsBuilder()

    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(updateEq2).toHaveBeenCalled()
  })

  it('returns 409 if the update affects no rows (race)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INVITATION_ID, invitee_id: AUTH_USER.id, status: 'pending' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null, count: 0 }) }),
      }),
    })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH({} as never, ctx())
    expect(res.status).toBe(409)
  })
})

// ── DELETE (reject) ──────────────────────────────────────────────────────

describe('DELETE /api/groups/invitations/[invitationId]', () => {
  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE({} as never, ctx())
    expect(res.status).toBe(401)
  })

  it('returns 404 if invitation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () => loadInvitation(null)
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE({} as never, ctx())
    expect(res.status).toBe(404)
  })

  it('returns 403 if caller is neither invitee nor inviter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, inviter_id: 'other-a', invitee_id: 'other-b' })
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE({} as never, ctx())
    expect(res.status).toBe(403)
  })

  it('rejects: deletes invitation + notification and returns ok', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const delEq = vi.fn().mockResolvedValue({ error: null, count: 1 })
    tableHandlers.group_invitations = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INVITATION_ID, inviter_id: 'owner-x', invitee_id: AUTH_USER.id },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: delEq }),
    })
    tableHandlers.notifications = notificationsBuilder()

    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE({} as never, ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
