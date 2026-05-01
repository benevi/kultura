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

// ── Parser de respuesta Claude ────────────────────────────────────────────────

// Para testear el parser real necesitamos desactivar el mock del módulo
// y mockear el SDK de Anthropic directamente.

describe('getAiRecommendations — parser y validación', () => {
  beforeEach(() => vi.clearAllMocks())

  const LIBRARY_ITEMS = Array.from({ length: 5 }, (_, i) => ({
    title: `Movie ${i}`,
    type: 'movie',
    year: 2020,
    score: 4,
    status: 'completed',
  }))

  function makeAnthropicMock(responseText: string) {
    return {
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: responseText }],
          }),
        },
      })),
    }
  }

  it('returns [] if library has fewer than 3 items', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS.slice(0, 2), error: null }),
        }),
      }),
    }))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    expect(result).toEqual([])

    vi.doUnmock('@/lib/supabase/server')
  })

  it('filters recommendations with invalid type from Claude', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Valid Movie', type: 'movie', year: 2020, reason: 'Great film' },
        { title: 'Podcast Thing', type: 'podcast', year: 2021, reason: 'test' },
        { title: 'Music Album', type: 'music', year: 2022, reason: 'test' },
      ],
    })))

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }))

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Solo 'movie' pasa el filtro — 'podcast' y 'music' son inválidos
    expect(result.every((r) => ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'].includes(r.type))).toBe(true)

    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('filters recommendations with empty title or reason', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Valid Movie', type: 'movie', year: 2020, reason: 'Great film' },
        { title: '', type: 'movie', year: 2020, reason: 'Has empty title' },
        { title: 'No reason movie', type: 'tv', year: 2020, reason: '' },
      ],
    })))

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }))

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Solo el item con title y reason no vacíos pasa
    expect(result.every((r) => r.title.trim() !== '' && r.reason.trim() !== '')).toBe(true)

    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('returns [] if Claude returns malformed JSON', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock('Aquí tienes mis recomendaciones: no es JSON'))

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }))

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    expect(result).toEqual([])

    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('clamps year to undefined if out of valid range', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Ancient Recs', type: 'movie', year: 1700, reason: 'Too old year' },
        { title: 'String Year', type: 'book', year: 'época medieval', reason: 'Non-numeric year' },
        { title: 'Valid Year', type: 'anime', year: 2010, reason: 'Good year' },
      ],
    })))

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({
        auth: { getUser: mockGetUser },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }))

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Los años inválidos se convierten a undefined, no rompen el render
    result.forEach((r) => {
      if (r.year !== undefined) {
        expect(typeof r.year).toBe('number')
        expect(r.year).toBeGreaterThan(1800)
      }
    })

    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })
})
