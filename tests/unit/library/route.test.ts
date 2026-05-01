// ============================================================
// KULTURA — Route Handler /api/library unit tests
// Verifica autenticación, validación y upsert/delete.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/library', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Mock factories ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockMediaUpsert = vi.fn()
const mockUserMediaUpsertSelect = vi.fn()
const mockUserMediaUpsert = vi.fn()
const mockUserMediaDelete = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'media') {
        return { upsert: mockMediaUpsert }
      }
      if (table === 'user_media') {
        return {
          upsert: mockUserMediaUpsert,
          delete: mockUserMediaDelete,
        }
      }
      return {}
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

// ── DB rows ───────────────────────────────────────────────────────────────────

const DB_ROW = {
  id: 'uuid-001',
  user_id: 'user-uuid-001',
  media_id: 'movie_550',
  status: 'completed',
  score: 4,
  watched_at: '2024-01-15',
  episode_progress: null,
  created_at: '2024-01-15T10:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve 401 si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(makeRequest({ mediaId: 'movie_550', status: 'completed' }))

    expect(response.status).toBe(401)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Not authenticated')
  })

  it('devuelve 400 con status inválido', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(makeRequest({ mediaId: 'movie_550', status: 'watching' }))

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toContain('status must be one of')
  })

  it('devuelve 400 si falta mediaId', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(makeRequest({ status: 'completed' }))

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('mediaId is required')
  })

  it('devuelve 200 y la entrada mapeada con upsert correcto', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    // No mediaCache — skip media upsert
    mockUserMediaUpsert.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValueOnce({ data: DB_ROW, error: null }),
      })),
    })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(
      makeRequest({ mediaId: 'movie_550', status: 'completed', score: 4, watchedAt: '2024-01-15' })
    )

    expect(response.status).toBe(200)
    const body = await response.json() as { entry: { id: string; status: string } }
    expect(body.entry.id).toBe('uuid-001')
    expect(body.entry.status).toBe('completed')
  })

  it('upserta en media cuando viene mediaCache', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockMediaUpsert.mockResolvedValueOnce({ error: null })
    mockUserMediaUpsert.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValueOnce({ data: DB_ROW, error: null }),
      })),
    })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(
      makeRequest({
        mediaId: 'movie_550',
        status: 'completed',
        mediaCache: {
          externalId: '550',
          type: 'movie',
          title: 'Fight Club',
          poster: '/poster.jpg',
          year: 1999,
        },
      })
    )

    expect(response.status).toBe(200)
    expect(mockMediaUpsert).toHaveBeenCalledOnce()
  })
})

describe('DELETE /api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve 401 si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } })

    const { DELETE } = await import('@/app/api/library/route')
    const response = await DELETE(makeRequest({ mediaId: 'movie_550' }, 'DELETE'))

    expect(response.status).toBe(401)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Not authenticated')
  })

  it('devuelve 404 si la entrada no existía', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockUserMediaDelete.mockReturnValueOnce({
      match: vi.fn().mockResolvedValueOnce({ error: null, count: 0 }),
    })

    const { DELETE } = await import('@/app/api/library/route')
    const response = await DELETE(makeRequest({ mediaId: 'movie_999' }, 'DELETE'))

    expect(response.status).toBe(404)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Entry not found')
  })

  it('devuelve 200 { ok: true } al eliminar correctamente', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockUserMediaDelete.mockReturnValueOnce({
      match: vi.fn().mockResolvedValueOnce({ error: null, count: 1 }),
    })

    const { DELETE } = await import('@/app/api/library/route')
    const response = await DELETE(makeRequest({ mediaId: 'movie_550' }, 'DELETE'))

    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
