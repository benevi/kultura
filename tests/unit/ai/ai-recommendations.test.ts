// ============================================================
// KULTURA — /api/ai-recommendations unit tests
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

const { mockGetDaily, mockReadToday, mockRateLimit } = vi.hoisted(() => ({
  mockGetDaily: vi.fn(),
  mockReadToday: vi.fn(),
  mockRateLimit: vi.fn(),
}))

vi.mock('@/lib/claude/recommendations', () => ({
  getDailyAiRecommendations: mockGetDaily,
  readTodayAiRecommendations: mockReadToday,
}))

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mockRateLimit }))

/** Las recomendaciones del día con la forma de D-06. */
function dailyReturns(recommendations: unknown[]) {
  mockGetDaily.mockResolvedValue({ recommendations, source: recommendations.length > 0 ? 'ai' : 'match' })
}

const mockShowcase = vi.fn()

vi.mock('@/lib/landing/showcase', async (orig) => ({
  ...(await orig<typeof import('@/lib/landing/showcase')>()),
  getLandingShowcase: mockShowcase,
}))

// ── GET /api/ai-recommendations ───────────────────────────────────────────────

describe('GET /api/ai-recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadToday.mockResolvedValue(null)
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 })
    mockShowcase.mockResolvedValue([
      { id: 'movie_550', title: 'Fight Club', type: 'movie', poster: 'https://p/1.jpg' },
      { id: 'anime_21', title: 'One Piece', type: 'anime', poster: 'https://p/2.jpg' },
    ])
  })

  it('sin recomendaciones propias manda lo popular para que Inicio no salga vacío', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    dailyReturns([])

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
    dailyReturns([
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
    dailyReturns([])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(0)
  })

  it('returns 200 with empty array when Anthropic API fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    dailyReturns([])

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()
    // Route siempre 200 — el fallo de Anthropic es silencioso para el cliente
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recommendations).toHaveLength(0)
  })

  // ── D-06: coste acotado ────────────────────────────────────────────────────

  it('lo de hoy ya guardado se sirve sin generar y antes del límite por minuto', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const today = { recommendations: [{ item: { id: 'movie_1' }, matchScore: 70 }], source: 'ai' }
    mockReadToday.mockResolvedValue(today)
    // Aunque el límite por minuto estuviera agotado (p. ej. la demo compartida).
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 })

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(today)
    expect(mockGetDaily).not.toHaveBeenCalled()
    expect(mockReadToday).toHaveBeenCalledWith('user-001', 'es')
  })

  it('sin nada guardado y con el límite por minuto agotado → 429 sin generar', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 })

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const res = await GET()

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(mockGetDaily).not.toHaveBeenCalled()
  })

  it('con el tope diario alcanzado responde source:match y capped:true', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetDaily.mockResolvedValue({
      recommendations: [{ item: { id: 'movie_1', externalId: '1', type: 'movie', title: 'X' }, matchScore: 60 }],
      source: 'match',
      capped: true,
    })

    const { GET } = await import('@/app/api/ai-recommendations/route')
    const body = await (await GET()).json()

    expect(body.source).toBe('match')
    expect(body.capped).toBe(true)
    expect(body.recommendations).toHaveLength(1)
  })

  it('genera con el usuario, sus géneros y el idioma activo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockGetDaily.mockResolvedValue({ recommendations: [], source: 'match' })

    const { GET } = await import('@/app/api/ai-recommendations/route')
    await GET()

    expect(mockGetDaily).toHaveBeenCalledWith('user-001', ['Thriller', 'Drama'], 'es', expect.anything())
  })
})
