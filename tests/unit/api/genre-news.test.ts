// ============================================================
// Tests unitarios — getGenreNews + GET /api/genre-news
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── genreNamesToIds (via TMDB_GENRE_MAP) ─────────────────────────────────────

describe('TMDB_GENRE_MAP', () => {
  it('contains common Spanish genre names', async () => {
    const { TMDB_GENRE_MAP } = await import('@/lib/api/tmdb')
    expect(TMDB_GENRE_MAP['Drama']).toBe(18)
    expect(TMDB_GENRE_MAP['Acción']).toBe(28)
    expect(TMDB_GENRE_MAP['Comedia']).toBe(35)
    expect(TMDB_GENRE_MAP['Terror']).toBe(27)
    expect(TMDB_GENRE_MAP['Thriller']).toBe(53)
  })

  it('contains English fallbacks', async () => {
    const { TMDB_GENRE_MAP } = await import('@/lib/api/tmdb')
    expect(TMDB_GENRE_MAP['Action']).toBe(28)
    expect(TMDB_GENRE_MAP['Comedy']).toBe(35)
    expect(TMDB_GENRE_MAP['Horror']).toBe(27)
  })
})

// ── getGenreNews ──────────────────────────────────────────────────────────────

describe('getGenreNews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty arrays if no genres map to TMDB ids', async () => {
    const { getGenreNews } = await import('@/lib/api/genre-news')
    const result = await getGenreNews(['UnknownGenre', 'FakeGenre'])
    expect(result.movies).toEqual([])
    expect(result.tv).toEqual([])
  })

  it('uses max 3 genres from topGenres', async () => {
    vi.doMock('@/lib/api/tmdb', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/api/tmdb')>()
      return {
        ...actual,
        discoverByGenre: vi.fn().mockResolvedValue({ results: [], page: 1, total_pages: 1, total_results: 0 }),
      }
    })

    const { getGenreNews } = await import('@/lib/api/genre-news')
    const genres = ['Drama', 'Acción', 'Comedia', 'Terror', 'Thriller']
    const result = await getGenreNews(genres)
    // Should not throw — just verifies it runs with 3 genre limit
    expect(result.genres.length).toBeLessThanOrEqual(3)

    vi.doUnmock('@/lib/api/tmdb')
  })

  it('handles TMDB API failure gracefully', async () => {
    vi.doMock('@/lib/api/tmdb', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/api/tmdb')>()
      return {
        ...actual,
        discoverByGenre: vi.fn().mockRejectedValue(new Error('TMDB down')),
      }
    })

    const { getGenreNews } = await import('@/lib/api/genre-news')
    const result = await getGenreNews(['Drama'])
    // Graceful degradation — empty arrays, no throw
    expect(result.movies).toEqual([])
    expect(result.tv).toEqual([])

    vi.doUnmock('@/lib/api/tmdb')
  })
})

// ── GET /api/genre-news ───────────────────────────────────────────────────────

describe('GET /api/genre-news', () => {
  const mockGetUser = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({ auth: { getUser: mockGetUser } }),
    }))
    vi.doMock('@/lib/rate-limit', () => ({
      checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0, remaining: 19 }),
    }))
    vi.doMock('@/lib/library/stats', () => ({
      getUserStats: vi.fn().mockResolvedValue({
        totalItems: 10,
        byType: [],
        topGenres: [{ genre: 'Drama', count: 5 }],
      }),
    }))
    vi.doMock('@/lib/api/genre-news', () => ({
      getGenreNews: vi.fn().mockResolvedValue({ movies: [], tv: [], genres: ['Drama'] }),
    }))
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/genre-news/route')
    const res = await GET()
    expect(res.status).toBe(401)
    vi.doUnmock('@/lib/supabase/server')
    vi.doUnmock('@/lib/rate-limit')
    vi.doUnmock('@/lib/library/stats')
    vi.doUnmock('@/lib/api/genre-news')
  })

  it('returns 200 with movies/tv/genres on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const { GET } = await import('@/app/api/genre-news/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.movies)).toBe(true)
    expect(Array.isArray(body.tv)).toBe(true)
    expect(Array.isArray(body.genres)).toBe(true)

    vi.doUnmock('@/lib/supabase/server')
    vi.doUnmock('@/lib/rate-limit')
    vi.doUnmock('@/lib/library/stats')
    vi.doUnmock('@/lib/api/genre-news')
  })

})
