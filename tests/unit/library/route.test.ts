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

// La fila de `media` la garantiza el servidor (SEG-2); su lógica se prueba en
// tests/unit/media. Aquí solo importa cómo la usa la ruta.
const mockEnsureMedia = vi.fn()
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  upsertMediaFromProvider: (...a: unknown[]) => mockEnsureMedia(...a),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

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
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    mockEnsureMedia.mockResolvedValue({ ok: true, id: 'movie_550', title: 'Fight Club', created: false })
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

  it('devuelve 400 con score fuera de rango (F3)', async () => {
    for (const badScore of [0, 6, 3.5, -1]) {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
      const { POST } = await import('@/app/api/library/route')
      const response = await POST(
        makeRequest({ mediaId: 'movie_550', status: 'completed', score: badScore })
      )
      expect(response.status, `score=${badScore}`).toBe(400)
      const body = await response.json() as { error: string }
      expect(body.error).toContain('score must be an integer between 1 and 5')
    }
  })

  it('devuelve 200 y la entrada mapeada con upsert correcto', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
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

  it('garantiza la fila de media desde el servidor y nunca la escribe con el cliente del usuario', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
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
        mediaCache: { externalId: '550', type: 'movie', title: 'Otro título', year: 1999 },
      })
    )

    expect(response.status).toBe(200)
    expect(mockEnsureMedia).toHaveBeenCalledWith('movie_550', { locale: 'es' })
    expect(mockMediaUpsert).not.toHaveBeenCalled()
  })

  it('si el proveedor no da la ficha de un título nuevo → 502 y no se toca user_media', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockEnsureMedia.mockResolvedValueOnce({ ok: false, id: 'movie_550', reason: 'unavailable' })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(makeRequest({ mediaId: 'movie_550', status: 'pending' }))

    expect(response.status).toBe(502)
    expect(mockUserMediaUpsert).not.toHaveBeenCalled()
  })

  it('un id que ningún proveedor puede resolver → 400', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockEnsureMedia.mockResolvedValueOnce({ ok: false, id: 'movie_x', reason: 'invalid_id' })

    const { POST } = await import('@/app/api/library/route')
    const response = await POST(makeRequest({ mediaId: 'movie_x', status: 'pending' }))

    expect(response.status).toBe(400)
    expect(mockUserMediaUpsert).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
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

  it('devuelve 429 si se supera el rate limit (E99)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid-001' } }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })

    const { DELETE } = await import('@/app/api/library/route')
    const response = await DELETE(makeRequest({ mediaId: 'movie_550' }, 'DELETE'))

    expect(response.status).toBe(429)
  })
})
