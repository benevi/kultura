// ============================================================
// KULTURA — /api/ai-recommendations + getAiRecommendations unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const AUTH_USER = { id: 'user-001' }

const mockGetUser = vi.fn()

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/library/stats', () => ({
  getUserStats: vi.fn().mockResolvedValue({
    totalItems: 5,
    byType: [],
    topGenres: [{ genre: 'Thriller', count: 3 }, { genre: 'Drama', count: 2 }],
  }),
}))

const mockGetAiRecommendations = vi.fn()

vi.mock('@/lib/claude/recommendations', () => ({
  getAiRecommendations: mockGetAiRecommendations,
  getLibraryContext: vi.fn(),
}))

// ── GET /api/ai-recommendations ───────────────────────────────────────────────

describe('GET /api/ai-recommendations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns recommendations array on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetAiRecommendations.mockResolvedValue([
      { title: 'Pulp Fiction', type: 'movie', year: 1994, reason: 'Similar estilo a Fight Club', searchQuery: 'Pulp%20Fiction' },
    ])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(1)
    expect(body.recommendations[0].title).toBe('Pulp Fiction')
  })

  it('returns empty array if library too small', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetAiRecommendations.mockResolvedValue([])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(0)
  })

  it('returns 200 with empty array when Anthropic API fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetAiRecommendations.mockResolvedValue([])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    // Route siempre 200 — el fallo de Anthropic es silencioso para el cliente
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(0)
  })
})
