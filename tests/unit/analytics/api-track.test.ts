// D-12: las rutas que alimentan el embudo llaman a track() una vez por hecho
// (clave de deduplicación) y la respuesta no cambia.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  track: vi.fn(),
  getUser: vi.fn(),
  upsertResult: { data: null as unknown, error: null as unknown },
  listLookup: vi.fn(),
  insertedList: { data: null as unknown, error: null as unknown },
}))

vi.mock('@/lib/analytics/track', () => ({ track: h.track }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  LIMITS: { library: {}, lists: {} },
}))
vi.mock('@/lib/social/lists', () => ({ canEditList: vi.fn(), getListAccess: vi.fn() }))
vi.mock('@/lib/media/upsert-from-provider', () => ({
  upsertMediaFromProvider: async () => ({ ok: true, id: 'movie_550', title: 'Fight Club', created: false }),
  mediaFailureStatus: () => ({ status: 502, error: 'x' }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => {
      if (table === 'user_media') {
        return { upsert: () => ({ select: () => ({ single: async () => h.upsertResult }) }) }
      }
      if (table === 'lists') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: h.listLookup }) }),
          update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
          // F-25: se crea SIN RETURNING (la RLS de SELECT no ve la fila nueva).
          insert: async () => h.insertedList,
        }
      }
      return {}
    },
  }),
}))

const USER = { id: 'u1' }
const ROW = {
  id: 'r1', user_id: 'u1', media_id: 'movie_550', status: 'completed', score: 4,
  watched_at: null, episode_progress: null, created_at: '2026-10-01T00:00:00Z',
}
const json = (url: string, method: string, body: unknown) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  h.track.mockResolvedValue(true)
  h.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  h.upsertResult = { data: ROW, error: null }
})

describe('POST /api/library', () => {
  it('guardar con nota → library_add y rating_set, una vez por título', async () => {
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(json('http://k/api/library', 'POST', { mediaId: 'movie_550', status: 'completed', score: 4 }))
    expect(res.status).toBe(200)
    expect(h.track).toHaveBeenCalledWith(USER, 'library_add', { media_type: 'movie', status: 'completed' }, {
      dedupeKey: 'library_add:u1:movie_550',
    })
    expect(h.track).toHaveBeenCalledWith(USER, 'rating_set', { media_type: 'movie', score: 4 }, {
      dedupeKey: 'rating_set:u1:movie_550',
    })
  })

  it('sin nota → solo library_add; si medir falla, la respuesta es la misma', async () => {
    h.track.mockResolvedValue(false)
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(json('http://k/api/library', 'POST', { mediaId: 'movie_550', status: 'pending' }))
    expect(res.status).toBe(200)
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.track.mock.calls[0][1]).toBe('library_add')
  })

  it('si no se guarda, no se mide', async () => {
    h.upsertResult = { data: null, error: { message: 'x' } }
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(json('http://k/api/library', 'POST', { mediaId: 'movie_550', status: 'pending' }))
    expect(res.status).toBe(500)
    expect(h.track).not.toHaveBeenCalled()
  })
})

describe('listas públicas', () => {
  it('PATCH isPublic=true → list_made_public una vez por lista; despublicar no cuenta', async () => {
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const params = { params: Promise.resolve({ id: 'list-1' }) }
    h.listLookup.mockResolvedValue({ data: { owner_id: 'u1' } })
    await PATCH(json('http://k/api/lists/list-1', 'PATCH', { isPublic: true }), params)
    expect(h.track).toHaveBeenCalledWith(USER, 'list_made_public', {}, { dedupeKey: 'list_made_public:list-1' })
    h.track.mockClear()
    await PATCH(json('http://k/api/lists/list-1', 'PATCH', { isPublic: false }), params)
    expect(h.track).not.toHaveBeenCalled()
  })

  it('POST de una lista que nace pública también cuenta; privada, no', async () => {
    const { POST } = await import('@/app/api/lists/route')
    h.insertedList = { data: null, error: null }
    h.listLookup.mockResolvedValue({ data: null, error: null })
    await POST(json('http://k/api/lists', 'POST', { name: 'Top', mediaType: 'anime', isPublic: true }))
    expect(h.track).toHaveBeenCalledWith(USER, 'list_made_public', { media_type: 'anime' }, {
      dedupeKey: expect.stringMatching(/^list_made_public:[0-9a-f-]{36}$/),
    })
    h.track.mockClear()
    await POST(json('http://k/api/lists', 'POST', { name: 'Mía', mediaType: 'anime' }))
    expect(h.track).not.toHaveBeenCalled()
  })
})
