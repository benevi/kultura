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

const mockShowcase = vi.fn()

vi.mock('@/lib/landing/showcase', async (orig) => ({
  ...(await orig<typeof import('@/lib/landing/showcase')>()),
  getLandingShowcase: mockShowcase,
}))

// ── GET /api/ai-recommendations ───────────────────────────────────────────────

describe('GET /api/ai-recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShowcase.mockResolvedValue([
      { id: 'movie_550', title: 'Fight Club', type: 'movie', poster: 'https://p/1.jpg' },
      { id: 'anime_21', title: 'One Piece', type: 'anime', poster: 'https://p/2.jpg' },
    ])
  })

  it('sin recomendaciones propias manda lo popular para que Inicio no salga vacío', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetAiRecommendations.mockResolvedValue([])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const body = await (await GET()).json()
    expect(body.starter).toEqual([
      expect.objectContaining({ id: 'movie_550', externalId: '550', type: 'movie', poster: 'https://p/1.jpg' }),
      expect.objectContaining({ id: 'anime_21', externalId: '21', type: 'anime' }),
    ])
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns recommendations array on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    // E-AIREC-CATALOG: cada rec lleva el MediaItem real del catálogo + su match.
    mockGetAiRecommendations.mockResolvedValue([
      {
        item: {
          id: 'movie_680',
          externalId: '680',
          type: 'movie',
          title: 'Pulp Fiction',
          year: 1994,
          poster: 'https://image.tmdb.org/t/p/w500/pulp.jpg',
        },
        matchScore: 87,
        reason: 'Similar estilo a Fight Club',
      },
    ])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(1)
    expect(body.recommendations[0].item.title).toBe('Pulp Fiction')
    // La ficha se enlaza con externalId (sin prefijo) — ver MediaCard.
    expect(body.recommendations[0].item.externalId).toBe('680')
    expect(body.recommendations[0].matchScore).toBe(87)
    // Con recomendaciones de verdad no se gasta la muestra popular.
    expect(body.starter).toBeUndefined()
    expect(mockShowcase).not.toHaveBeenCalled()
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
