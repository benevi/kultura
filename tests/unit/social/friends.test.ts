// ============================================================
// KULTURA — lib/social/friends.ts unit tests
// Verifica getFriends, getPendingRequests y getFriendshipStatus.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-001'
const OTHER_ID = 'user-002'

const FRIEND_ROW = {
  id: 'f-001',
  requester_id: USER_ID,
  receiver_id: OTHER_ID,
  status: 'accepted',
  created_at: '2024-01-01T00:00:00Z',
  requester: { id: USER_ID, username: 'alice', avatar_color: '#E82020', avatar_initials: 'AL' },
  receiver: { id: OTHER_ID, username: 'bob', avatar_color: '#1E90FF', avatar_initials: 'BO' },
}

const PENDING_ROW = {
  id: 'f-002',
  requester_id: OTHER_ID,
  receiver_id: USER_ID,
  status: 'pending',
  created_at: '2024-01-02T00:00:00Z',
  requester: { id: OTHER_ID, username: 'bob', avatar_color: '#1E90FF', avatar_initials: 'BO' },
  receiver: { id: USER_ID, username: 'alice', avatar_color: '#E82020', avatar_initials: 'AL' },
}

// ── Mock de Supabase ──────────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn()
const mockOrder = vi.fn()
const mockOrQuery = vi.fn()
const mockEqStatus = vi.fn()
const mockEqReceiver = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  }),
}))

// ── getFriends ────────────────────────────────────────────────────────────────

describe('getFriends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped Friendship[] for accepted rows', async () => {
    mockOrder.mockResolvedValue({ data: [FRIEND_ROW], error: null })
    mockOrQuery.mockReturnValue({ order: mockOrder })
    mockEqStatus.mockReturnValue({ or: mockOrQuery })
    mockSelect.mockReturnValue({ eq: mockEqStatus })

    const { getFriends } = await import('@/lib/social/friends')
    const result = await getFriends(USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('f-001')
    expect(result[0].status).toBe('accepted')
    // otherUser debe ser el receiver (bob) porque el user es el requester
    expect(result[0].otherUser?.username).toBe('bob')
  })

  it('throws if Supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    mockOrQuery.mockReturnValue({ order: mockOrder })
    mockEqStatus.mockReturnValue({ or: mockOrQuery })
    mockSelect.mockReturnValue({ eq: mockEqStatus })

    const { getFriends } = await import('@/lib/social/friends')
    await expect(getFriends(USER_ID)).rejects.toThrow('Failed to fetch friends')
  })
})

// ── getPendingRequests ────────────────────────────────────────────────────────

describe('getPendingRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pending requests where user is receiver', async () => {
    mockOrder.mockResolvedValue({ data: [PENDING_ROW], error: null })
    mockEqReceiver.mockReturnValue({ order: mockOrder })
    mockEqStatus.mockReturnValue({ eq: mockEqReceiver })
    mockSelect.mockReturnValue({ eq: mockEqStatus })

    const { getPendingRequests } = await import('@/lib/social/friends')
    const result = await getPendingRequests(USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('pending')
    // otherUser debe ser el requester (bob)
    expect(result[0].otherUser?.username).toBe('bob')
  })

  it('returns empty array if no pending requests', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockEqReceiver.mockReturnValue({ order: mockOrder })
    mockEqStatus.mockReturnValue({ eq: mockEqReceiver })
    mockSelect.mockReturnValue({ eq: mockEqStatus })

    const { getPendingRequests } = await import('@/lib/social/friends')
    const result = await getPendingRequests(USER_ID)
    expect(result).toHaveLength(0)
  })
})

// ── getFriendshipStatus ───────────────────────────────────────────────────────

describe('getFriendshipStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "none" if no friendship found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
    const mockOr = vi.fn(() => ({ limit: mockLimit }))
    mockSelect.mockReturnValue({ or: mockOr })

    const { getFriendshipStatus } = await import('@/lib/social/friends')
    const result = await getFriendshipStatus(USER_ID, OTHER_ID)
    expect(result).toBe('none')
  })

  it('returns "accepted" for accepted friendship', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { requester_id: USER_ID, receiver_id: OTHER_ID, status: 'accepted' },
      error: null,
    })
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
    const mockOr = vi.fn(() => ({ limit: mockLimit }))
    mockSelect.mockReturnValue({ or: mockOr })

    const { getFriendshipStatus } = await import('@/lib/social/friends')
    const result = await getFriendshipStatus(USER_ID, OTHER_ID)
    expect(result).toBe('accepted')
  })

  it('returns "pending_sent" when user is requester and status is pending', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { requester_id: USER_ID, receiver_id: OTHER_ID, status: 'pending' },
      error: null,
    })
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
    const mockOr = vi.fn(() => ({ limit: mockLimit }))
    mockSelect.mockReturnValue({ or: mockOr })

    const { getFriendshipStatus } = await import('@/lib/social/friends')
    const result = await getFriendshipStatus(USER_ID, OTHER_ID)
    expect(result).toBe('pending_sent')
  })

  it('returns "pending_received" when user is receiver and status is pending', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { requester_id: OTHER_ID, receiver_id: USER_ID, status: 'pending' },
      error: null,
    })
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
    const mockOr = vi.fn(() => ({ limit: mockLimit }))
    mockSelect.mockReturnValue({ or: mockOr })

    const { getFriendshipStatus } = await import('@/lib/social/friends')
    const result = await getFriendshipStatus(USER_ID, OTHER_ID)
    expect(result).toBe('pending_received')
  })
})
