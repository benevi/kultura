// ============================================================
// KULTURA — actions.ts unit tests
// Verifica que los helpers cliente de biblioteca hablan con /api/library
// con el contrato de la fase 7 (`{ data }` / `{ error: { code } }`).
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

  describe('saveLibraryEntry', () => {
    it('hace POST a /api/library con el payload y devuelve data', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { entry: MOCK_ENTRY, log: null, logFailed: false } }), { status: 200 })
      )

      const { saveLibraryEntry } = await import('@/lib/library/actions')
      const result = await saveLibraryEntry(PAYLOAD)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/library')
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body as string)).toEqual(PAYLOAD)
      expect(result).toEqual({ entry: MOCK_ENTRY, log: null, logFailed: false })
    })

    it('lanza ApiError con el code del contrato', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'provider_unavailable' } }), { status: 502 })
      )

      const { saveLibraryEntry } = await import('@/lib/library/actions')
      const { ApiError } = await import('@/lib/api/client')
      const err = await saveLibraryEntry(PAYLOAD).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).code).toBe('provider_unavailable')
    })
  })

  describe('removeFromLibrary', () => {
    it('hace DELETE a /api/library con mediaId', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: null }), { status: 200 })
      )

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await removeFromLibrary('movie_550')

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/library')
      expect(options.method).toBe('DELETE')
      expect(JSON.parse(options.body as string)).toEqual({ mediaId: 'movie_550' })
    })

    it('keepalive llega a fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: null }), { status: 200 })
      )
      const { removeFromLibrary } = await import('@/lib/library/actions')
      await removeFromLibrary('movie_550', { keepalive: true })
      expect((fetchSpy.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
    })

    it('lanza ApiError not_found si no estaba', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 })
      )

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await expect(removeFromLibrary('movie_550')).rejects.toMatchObject({ code: 'not_found', status: 404 })
    })

    it('sin cuerpo, el code sale del estado', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }))

      const { removeFromLibrary } = await import('@/lib/library/actions')
      await expect(removeFromLibrary('movie_550')).rejects.toMatchObject({ code: 'internal' })
    })
  })
})
