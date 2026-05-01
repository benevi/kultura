// ============================================================
// KULTURA — actions.ts unit tests
// Verifica que los helpers cliente de biblioteca hacen fetch
// al Route Handler correctamente.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry, LibraryPayload } from '@/types/library'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ENTRY: LibraryEntry = {
  id: 'uuid-001',
  userId: 'user-uuid-001',
  mediaId: 'movie_550',
  status: 'completed',
  score: 4,
  watchedAt: '2024-01-15',
  episodeProgress: null,
  createdAt: '2024-01-15T10:00:00Z',
}

const PAYLOAD: LibraryPayload = {
  mediaId: 'movie_550',
  status: 'completed',
  score: 4,
  watchedAt: '2024-01-15',
  mediaCache: {
    externalId: '550',
    type: 'movie',
    title: 'Fight Club',
    poster: '/poster.jpg',
    year: 1999,
  },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('library/actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('addToLibrary', () => {
    it('hace POST a /api/library con el payload correcto', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ entry: MOCK_ENTRY }), { status: 200 })
      )

      const { addToLibrary } = await import('@/lib/library/actions')
      const result = await addToLibrary(PAYLOAD)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/library')
      expect(options.method).toBe('POST')
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(options.body as string)).toEqual(PAYLOAD)
      expect(result).toEqual(MOCK_ENTRY)
    })

    it('lanza Error si la respuesta no es ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
      )

      const { addToLibrary } = await import('@/lib/library/actions')
      await expect(addToLibrary(PAYLOAD)).rejects.toThrow('Not authenticated')
    })

    it('lanza Error con mensaje genérico si no hay error en el body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 500 })
      )

      const { addToLibrary } = await import('@/lib/library/actions')
      await expect(addToLibrary(PAYLOAD)).rejects.toThrow('Failed to add to library')
    })
  })

  describe('updateLibrary', () => {
    it('hace POST a /api/library con el payload correcto', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ entry: MOCK_ENTRY }), { status: 200 })
      )

      const { updateLibrary } = await import('@/lib/library/actions')
      const updatePayload: LibraryPayload = { ...PAYLOAD, status: 'in_progress', score: 3 }
      const result = await updateLibrary(updatePayload)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/library')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body as string)).toEqual(updatePayload)
      expect(result).toEqual(MOCK_ENTRY)
    })

    it('lanza Error si la respuesta no es ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Failed to update library entry' }), { status: 500 })
      )

      const { updateLibrary } = await import('@/lib/library/actions')
      await expect(updateLibrary(PAYLOAD)).rejects.toThrow('Failed to update library entry')
    })
  })

  describe('removeFromLibrary', () => {
    it('hace DELETE a /api/library con mediaId', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await removeFromLibrary('movie_550')

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/library')
      expect(options.method).toBe('DELETE')
      expect(JSON.parse(options.body as string)).toEqual({ mediaId: 'movie_550' })
    })

    it('lanza Error si la respuesta no es ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Entry not found' }), { status: 404 })
      )

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await expect(removeFromLibrary('movie_550')).rejects.toThrow('Entry not found')
    })

    it('lanza Error con mensaje genérico si no hay error en el body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 500 })
      )

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await expect(removeFromLibrary('movie_550')).rejects.toThrow('Failed to remove from library')
    })
  })
})
