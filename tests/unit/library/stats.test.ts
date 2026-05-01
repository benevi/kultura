// ============================================================
// KULTURA — getUserStats unit tests
// Verifica la agregación de estadísticas de biblioteca personal.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSupabaseResponse(data: unknown[] | null, error: unknown = null) {
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ data, error })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getUserStats', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sin filas → devuelve estructura vacía', async () => {
    makeSupabaseResponse([])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result).toEqual({ totalItems: 0, totalCompleted: 0, totalInProgress: 0, byType: [], topGenres: [] })
  })

  it('agrupa por tipo correctamente — movie×2, tv×1', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: {} } },
      { status: 'pending', media: { type: 'movie', metadata: {} } },
      { status: 'completed', media: { type: 'tv', metadata: {} } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result.byType).toHaveLength(2)
    const movieStat = result.byType.find(s => s.type === 'movie')
    expect(movieStat?.total).toBe(2)
    const tvStat = result.byType.find(s => s.type === 'tv')
    expect(tvStat?.total).toBe(1)
  })

  it('cuenta completed correctamente', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: {} } },
      { status: 'completed', media: { type: 'movie', metadata: {} } },
      { status: 'pending', media: { type: 'movie', metadata: {} } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    const movieStat = result.byType.find(s => s.type === 'movie')
    expect(movieStat?.completed).toBe(2)
  })

  it('ordena byType por total descendente', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'book', metadata: {} } },
      { status: 'completed', media: { type: 'movie', metadata: {} } },
      { status: 'pending', media: { type: 'movie', metadata: {} } },
      { status: 'pending', media: { type: 'movie', metadata: {} } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result.byType[0].type).toBe('movie')
    expect(result.byType[1].type).toBe('book')
  })

  it('extrae géneros de metadata.genres', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Action', 'Drama'] } } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    const genres = result.topGenres.map(g => g.genre)
    expect(genres).toContain('Action')
    expect(genres).toContain('Drama')
  })

  it('cuenta frecuencia de géneros correctamente', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Action', 'Drama'] } } },
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Action'] } } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    const actionGenre = result.topGenres.find(g => g.genre === 'Action')
    expect(actionGenre?.count).toBe(2)
    const dramaGenre = result.topGenres.find(g => g.genre === 'Drama')
    expect(dramaGenre?.count).toBe(1)
  })

  it('devuelve máximo 5 géneros en topGenres', async () => {
    const genres = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: { genres } } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result.topGenres.length).toBeLessThanOrEqual(5)
  })

  it('ordena topGenres por count descendente', async () => {
    makeSupabaseResponse([
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Drama'] } } },
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Action', 'Drama'] } } },
      { status: 'completed', media: { type: 'movie', metadata: { genres: ['Action', 'Drama'] } } },
    ])
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result.topGenres[0].genre).toBe('Drama')
    expect(result.topGenres[0].count).toBe(3)
    expect(result.topGenres[1].genre).toBe('Action')
    expect(result.topGenres[1].count).toBe(2)
  })

  it('error de Supabase → devuelve estructura vacía', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: new Error('DB error') })
    const { getUserStats } = await import('@/lib/library/stats')
    const result = await getUserStats('user-1')
    expect(result).toEqual({ totalItems: 0, totalCompleted: 0, totalInProgress: 0, byType: [], topGenres: [] })
  })
})
