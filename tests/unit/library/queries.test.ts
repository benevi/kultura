// ============================================================
// KULTURA — queries.ts unit tests
// Verifica que los helpers servidor de biblioteca consultan
// Supabase correctamente.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DB_ROW_1 = {
  id: 'uuid-001',
  user_id: 'user-uuid-001',
  media_id: 'movie_550',
  status: 'completed' as const,
  score: 4,
  watched_at: '2024-01-15',
  episode_progress: null,
  created_at: '2024-01-15T10:00:00Z',
}

const DB_ROW_2 = {
  id: 'uuid-002',
  user_id: 'user-uuid-001',
  media_id: 'anime_1535',
  status: 'in_progress' as const,
  score: null,
  watched_at: null,
  episode_progress: { season: 1, episode: 5 },
  created_at: '2024-01-10T10:00:00Z',
}

// ── Mock de Supabase server client ────────────────────────────────────────────

const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockEqMediaId = vi.fn(() => ({ limit: mockLimit }))
const mockOrder = vi.fn()
const mockEqUserId = vi.fn(() => ({ eq: mockEqMediaId, order: mockOrder }))

// Para getUserMedia: .select('*').eq('user_id', ...).order(...)
// Para getMediaEntry: .select('*').eq('user_id', ...).eq('media_id', ...).limit(1).maybeSingle()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: mockEqUserId,
        order: mockOrder,
      })),
    })),
  }),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('library/queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserMedia', () => {
    it('devuelve entradas ordenadas por created_at DESC', async () => {
      // Configura la cadena: .eq('user_id').order()
      mockOrder.mockResolvedValueOnce({
        data: [DB_ROW_1, DB_ROW_2],
        error: null,
      })

      const { getUserMedia } = await import('@/lib/library/queries')
      const result = await getUserMedia('user-uuid-001')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject<Partial<LibraryEntry>>({
        id: 'uuid-001',
        userId: 'user-uuid-001',
        mediaId: 'movie_550',
        status: 'completed',
        score: 4,
        watchedAt: '2024-01-15',
        episodeProgress: null,
      })
      expect(result[1]).toMatchObject<Partial<LibraryEntry>>({
        id: 'uuid-002',
        mediaId: 'anime_1535',
        status: 'in_progress',
        episodeProgress: { season: 1, episode: 5 },
      })
    })

    it('lanza Error si Supabase devuelve error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB connection failed' },
      })

      const { getUserMedia } = await import('@/lib/library/queries')
      await expect(getUserMedia('user-uuid-001')).rejects.toThrow('DB connection failed')
    })
  })

  describe('getMediaEntry', () => {
    it('devuelve null si no hay fila', async () => {
      mockEqMediaId.mockReturnValueOnce({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        })),
      })

      const { getMediaEntry } = await import('@/lib/library/queries')
      const result = await getMediaEntry('user-uuid-001', 'movie_999')

      expect(result).toBeNull()
    })

    it('devuelve LibraryEntry si hay fila', async () => {
      mockEqMediaId.mockReturnValueOnce({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValueOnce({ data: DB_ROW_1, error: null }),
        })),
      })

      const { getMediaEntry } = await import('@/lib/library/queries')
      const result = await getMediaEntry('user-uuid-001', 'movie_550')

      expect(result).not.toBeNull()
      expect(result).toMatchObject<Partial<LibraryEntry>>({
        id: 'uuid-001',
        userId: 'user-uuid-001',
        mediaId: 'movie_550',
        status: 'completed',
        score: 4,
        watchedAt: '2024-01-15',
        episodeProgress: null,
      })
    })

    it('lanza Error si Supabase devuelve error', async () => {
      mockEqMediaId.mockReturnValueOnce({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Query failed' },
          }),
        })),
      })

      const { getMediaEntry } = await import('@/lib/library/queries')
      await expect(getMediaEntry('user-uuid-001', 'movie_550')).rejects.toThrow('Query failed')
    })
  })
})
