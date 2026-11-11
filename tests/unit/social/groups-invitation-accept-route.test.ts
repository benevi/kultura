// ============================================================
// KULTURA — Route Handler /api/groups/invitations/[invitationId] unit tests
// PATCH: aceptar (invitee-only, trigger da el alta), DELETE: rechazar.
// Contrato: { data: null } / { error: { code, message? } }.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GROUP_ERRORS } from '@/lib/api/contracts/groups'

const INVITATION_ID = '44444444-4444-4444-8444-444444444444'

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

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

function req(method: string): Request {
  return new Request(`http://localhost/api/groups/invitations/${INVITATION_ID}`, { method })
}

function ctx(invitationId = INVITATION_ID) {
  return { params: Promise.resolve({ invitationId }) }
}

const AUTH_USER = { id: '22222222-2222-4222-8222-222222222222' }
const OTHER_A = '55555555-5555-4555-8555-555555555555'
const OTHER_B = '66666666-6666-4666-8666-666666666666'

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
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
  })

  it('returns 404 if invitation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () => loadInvitation(null)
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 403 if caller is not the invitee', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, invitee_id: OTHER_A, status: 'pending' })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('returns 409 if invitation is not pending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, invitee_id: AUTH_USER.id, status: 'accepted' })
    const { PATCH } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'conflict', message: GROUP_ERRORS.invitationResolved })
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
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
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
    const res = await PATCH(req('PATCH'), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'conflict', message: GROUP_ERRORS.invitationResolved })
  })
})

// ── DELETE (reject) ──────────────────────────────────────────────────────

describe('DELETE /api/groups/invitations/[invitationId]', () => {
  it('returns 404 if the invitation id is not a uuid (no DB access)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE(req('DELETE'), ctx('inv-001'))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE(req('DELETE'), ctx())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
  })

  it('returns 404 if invitation not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () => loadInvitation(null)
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE(req('DELETE'), ctx())
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('returns 403 if caller is neither invitee nor inviter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    tableHandlers.group_invitations = () =>
      loadInvitation({ id: INVITATION_ID, inviter_id: OTHER_A, invitee_id: OTHER_B })
    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE(req('DELETE'), ctx())
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('rejects: deletes invitation + notification and returns ok', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const delEq = vi.fn().mockResolvedValue({ error: null, count: 1 })
    tableHandlers.group_invitations = () => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INVITATION_ID, inviter_id: OTHER_A, invitee_id: AUTH_USER.id },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({ eq: delEq }),
    })
    tableHandlers.notifications = notificationsBuilder()

    const { DELETE } = await import('@/app/api/groups/invitations/[invitationId]/route')
    const res = await DELETE(req('DELETE'), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
  })
})
