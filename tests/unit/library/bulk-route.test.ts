// ============================================================
// POST /api/library/bulk (saneamiento 6.4): «Añadir toda la franquicia» en
// una petición. Solo inserta (ignoreDuplicates), salta lo que ya está, deja
// en `failed` lo que el proveedor no da y mide un library_add por añadido.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { libraryBulkResultSchema, LIBRARY_BULK_MAX } from '@/lib/api/contracts/library'

const h = vi.hoisted(() => ({
  track: vi.fn(),
  getUser: vi.fn(),
  ensure: vi.fn(),
  invalidate: vi.fn(),
  owned: { data: [] as unknown, error: null as unknown },
  upsert: vi.fn(),
  upsertResult: { data: [] as unknown, error: null as unknown },
}))

vi.mock('@/lib/analytics/track', () => ({ track: h.track }))
vi.mock('@/lib/library/invalidate', () => ({ invalidateLibraryCaches: h.invalidate }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  LIMITS: { library: {}, library_bulk: {} },
}))
vi.mock('@/lib/media/upsert-from-provider', () => ({
  upsertMediaFromProvider: vi.fn(),
  ensureMediaRows: h.ensure,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => {
      if (table !== 'user_media') return {}
      return {
        select: () => ({ eq: () => ({ in: async () => h.owned }) }),
        upsert: (rows: unknown, opts: unknown) => {
          h.upsert(rows, opts)
          return { select: async () => h.upsertResult }
        },
      }
    },
  }),
}))

const USER = { id: 'u1' }
const post = (body: unknown) =>
  new Request('http://k/api/library/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  h.track.mockResolvedValue(true)
  h.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  h.owned = { data: [], error: null }
  h.upsertResult = { data: [], error: null }
  h.ensure.mockImplementation(async (ids: string[]) => ({ available: new Set(ids), unresolved: [] }))
})

describe('POST /api/library/bulk', () => {
  it('401 sin sesión', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('@/app/api/library/bulk/route')
    expect((await POST(post({ mediaIds: ['movie_1'] }))).status).toBe(401)
  })

  it('400 con lista vacía, repetidos, id inválido o más del máximo', async () => {
    const { POST } = await import('@/app/api/library/bulk/route')
    const many = Array.from({ length: LIBRARY_BULK_MAX + 1 }, (_, i) => `movie_${i + 1}`)
    for (const mediaIds of [[], ['movie_1', 'movie_1'], ['nope'], many]) {
      expect((await POST(post({ mediaIds }))).status).toBe(400)
    }
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('inserta como Pendiente solo lo que falta, sin pisar (ignoreDuplicates)', async () => {
    h.owned = { data: [{ media_id: 'movie_2' }], error: null }
    h.upsertResult = { data: [{ media_id: 'movie_1' }, { media_id: 'tv_3' }], error: null }
    const { POST } = await import('@/app/api/library/bulk/route')
    const res = await POST(post({ mediaIds: ['movie_1', 'movie_2', 'tv_3'] }))
    expect(res.status).toBe(200)
    // Lo que ya estaba ni se pide al proveedor.
    expect(h.ensure).toHaveBeenCalledWith(['movie_1', 'tv_3'], expect.anything())
    expect(h.upsert).toHaveBeenCalledWith(
      [
        { user_id: 'u1', media_id: 'movie_1', status: 'pending' },
        { user_id: 'u1', media_id: 'tv_3', status: 'pending' },
      ],
      { onConflict: 'user_id,media_id', ignoreDuplicates: true }
    )
    expect(libraryBulkResultSchema.parse((await res.json()).data)).toEqual({
      added: ['movie_1', 'tv_3'],
      skipped: ['movie_2'],
      failed: [],
    })
    expect(h.invalidate).toHaveBeenCalledTimes(1)
    expect(h.track).toHaveBeenCalledTimes(2)
    expect(h.track).toHaveBeenCalledWith(USER, 'library_add', { media_type: 'tv', status: 'pending' }, {
      dedupeKey: 'library_add:u1:tv_3',
    })
  })

  it('lo que entra entretanto (no vuelve en RETURNING) cuenta como ya estaba', async () => {
    h.upsertResult = { data: [{ media_id: 'movie_1' }], error: null }
    const { POST } = await import('@/app/api/library/bulk/route')
    const res = await POST(post({ mediaIds: ['movie_1', 'movie_2'] }))
    expect((await res.json()).data).toEqual({ added: ['movie_1'], skipped: ['movie_2'], failed: [] })
  })

  it('sin ficha del proveedor: va a failed y no se inserta', async () => {
    h.ensure.mockResolvedValue({ available: new Set(['movie_1']), unresolved: ['book_X'] })
    h.upsertResult = { data: [{ media_id: 'movie_1' }], error: null }
    const { POST } = await import('@/app/api/library/bulk/route')
    const res = await POST(post({ mediaIds: ['movie_1', 'book_OLX'] }))
    expect((await res.json()).data).toEqual({ added: ['movie_1'], skipped: [], failed: ['book_OLX'] })
    expect((h.upsert.mock.calls[0][0] as unknown[]).length).toBe(1)
  })

  it('todo ya estaba: ni proveedor útil ni insert, ni caché ni medición', async () => {
    h.owned = { data: [{ media_id: 'movie_1' }], error: null }
    const { POST } = await import('@/app/api/library/bulk/route')
    const res = await POST(post({ mediaIds: ['movie_1'] }))
    expect((await res.json()).data).toEqual({ added: [], skipped: ['movie_1'], failed: [] })
    expect(h.upsert).not.toHaveBeenCalled()
    expect(h.invalidate).not.toHaveBeenCalled()
    expect(h.track).not.toHaveBeenCalled()
  })

  it('500 si falla leer la biblioteca, el catálogo o el insert', async () => {
    const { POST } = await import('@/app/api/library/bulk/route')
    h.owned = { data: null, error: { message: 'boom' } }
    expect((await POST(post({ mediaIds: ['movie_1'] }))).status).toBe(500)

    h.owned = { data: [], error: null }
    h.ensure.mockRejectedValueOnce(new Error('media: boom'))
    expect((await POST(post({ mediaIds: ['movie_1'] }))).status).toBe(500)

    h.upsertResult = { data: null, error: { message: 'boom' } }
    expect((await POST(post({ mediaIds: ['movie_1'] }))).status).toBe(500)
  })
})
