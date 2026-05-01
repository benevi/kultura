// ============================================================
// KULTURA — lib/social/feed.ts unit tests
// Verifica getFriendsFeed: friends query + feed query.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-001'
const FRIEND_ID = 'user-002'

const FRIENDSHIP_ROW = {
  requester_id: USER_ID,
  receiver_id: FRIEND_ID,
}

const FEED_ROW = {
  id: 'um-001',
  user_id: FRIEND_ID,
  media_id: 'movie_550',
  status: 'completed' as const,
  score: 5,
  created_at: '2024-03-01T10:00:00Z',
  updated_at: '2024-03-15T10:00:00Z',
  user: {
    id: FRIEND_ID,
    username: 'bob',
    avatar_color: '#1E90FF',
    avatar_initials: 'BO',
  },
  media: {
    id: 'movie_550',
    title: 'Fight Club',
    poster: 'https://example.com/poster.jpg',
    type: 'movie',
  },
}

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockFriendshipsChain = {
  select: vi.fn(),
}

const mockUserMediaChain = {
  select: vi.fn(),
}

let fromCallCount = 0

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'friendships') return mockFriendshipsChain
      if (table === 'user_media') return mockUserMediaChain
      return {}
    }),
  }),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getFriendsFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromCallCount = 0
  })

  it('returns empty array if user has no friends', async () => {
    const mockOr = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    const result = await getFriendsFeed(USER_ID)

    expect(result).toEqual([])
    // no debe consultar user_media si no hay amigos
    expect(mockUserMediaChain.select).not.toHaveBeenCalled()
  })

  it('throws if friendships query fails', async () => {
    const mockOr = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    await expect(getFriendsFeed(USER_ID)).rejects.toThrow('Failed to fetch friendships')
  })

  it('resolves friend IDs correctly (user as requester)', async () => {
    const mockOr = vi.fn().mockResolvedValue({ data: [FRIENDSHIP_ROW], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const mockLimit = vi.fn().mockResolvedValue({ data: [FEED_ROW], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockIn = vi.fn(() => ({ order: mockOrder }))
    mockUserMediaChain.select.mockReturnValue({ in: mockIn })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    const result = await getFriendsFeed(USER_ID)

    // friend ID debe ser receiver_id cuando user es requester
    expect(mockIn).toHaveBeenCalledWith('user_id', [FRIEND_ID])
    expect(result).toHaveLength(1)
  })

  it('resolves friend IDs correctly (user as receiver)', async () => {
    const reversedRow = { requester_id: FRIEND_ID, receiver_id: USER_ID }
    const mockOr = vi.fn().mockResolvedValue({ data: [reversedRow], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const mockLimit = vi.fn().mockResolvedValue({ data: [FEED_ROW], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockIn = vi.fn(() => ({ order: mockOrder }))
    mockUserMediaChain.select.mockReturnValue({ in: mockIn })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    await getFriendsFeed(USER_ID)

    // friend ID debe ser requester_id cuando user es receiver
    expect(mockIn).toHaveBeenCalledWith('user_id', [FRIEND_ID])
  })

  it('maps FeedRow to FeedEntry correctly', async () => {
    const mockOr = vi.fn().mockResolvedValue({ data: [FRIENDSHIP_ROW], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const mockLimit = vi.fn().mockResolvedValue({ data: [FEED_ROW], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockIn = vi.fn(() => ({ order: mockOrder }))
    mockUserMediaChain.select.mockReturnValue({ in: mockIn })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    const result = await getFriendsFeed(USER_ID)

    expect(result[0]).toMatchObject({
      id: 'um-001',
      userId: FRIEND_ID,
      mediaId: 'movie_550',
      status: 'completed',
      score: 5,
      createdAt: '2024-03-01T10:00:00Z',
      updatedAt: '2024-03-15T10:00:00Z',
      user: { username: 'bob' },
      media: { title: 'Fight Club' },
    })
  })

  it('filters out rows with null user', async () => {
    const rowWithNullUser = { ...FEED_ROW, user: null }
    const mockOr = vi.fn().mockResolvedValue({ data: [FRIENDSHIP_ROW], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const mockLimit = vi.fn().mockResolvedValue({ data: [rowWithNullUser], error: null })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockIn = vi.fn(() => ({ order: mockOrder }))
    mockUserMediaChain.select.mockReturnValue({ in: mockIn })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    const result = await getFriendsFeed(USER_ID)

    expect(result).toHaveLength(0)
  })

  it('throws if user_media query fails', async () => {
    const mockOr = vi.fn().mockResolvedValue({ data: [FRIENDSHIP_ROW], error: null })
    const mockEqStatus = vi.fn(() => ({ or: mockOr }))
    mockFriendshipsChain.select.mockReturnValue({ eq: mockEqStatus })

    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockOrder = vi.fn(() => ({ limit: mockLimit }))
    const mockIn = vi.fn(() => ({ order: mockOrder }))
    mockUserMediaChain.select.mockReturnValue({ in: mockIn })

    const { getFriendsFeed } = await import('@/lib/social/feed')
    await expect(getFriendsFeed(USER_ID)).rejects.toThrow('Failed to fetch feed')
  })
})
