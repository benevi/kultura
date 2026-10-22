// ============================================================
// KULTURA — Regresión SEG-2 en las otras dos vías de escritura de `media`:
// añadir a una lista (`POST /api/lists/[id]`) y recomendar a un amigo
// (`POST /api/recommendations`). Las dos hacían upsert con `mediaCache` del
// navegador; además la notificación de la recomendación copiaba el título
// que mandaba el remitente.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb, fakeClient, type FakeDb } from './fake-supabase'

const { state, getMovieMock } = vi.hoisted(() => ({
  state: { db: null as unknown as FakeDb },
  getMovieMock: vi.fn(),
}))

const USER = { id: 'user-1' }
const FRIEND = { id: 'user-2' }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => fakeClient(state.db, 'user', USER),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(state.db, 'admin'),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
}))
vi.mock('@/lib/social/lists', () => ({ canEditList: vi.fn(async () => true) }))
vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  getMovie: getMovieMock,
}))

const POISON = {
  externalId: '550',
  type: 'movie',
  title: 'TÍTULO ENVENENADO',
  poster: 'https://lh3.googleusercontent.com/attacker.png',
  synopsis: 'texto ofensivo',
  genres: ['Spam'],
}

const REAL_ROW = {
  id: 'movie_550',
  external_id: '550',
  type: 'movie',
  title: 'El club de la lucha',
  poster: 'https://image.tmdb.org/t/p/w500/real.jpg',
  synopsis: 'Un oficinista insomne…',
  metadata: { genres: ['Drama'] },
}

function req(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', referer: 'https://kulturaapp.vercel.app/es/media/movie/550' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getMovieMock.mockResolvedValue({
    id: 550,
    title: 'El club de la lucha',
    original_title: 'Fight Club',
    overview: 'Un oficinista insomne…',
    poster_path: '/real.jpg',
    backdrop_path: null,
    release_date: '1999-10-15',
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 8.4,
  })
  state.db = createFakeDb({
    media: [{ ...REAL_ROW }],
    users: [
      { id: USER.id, username: 'alice' },
      { id: FRIEND.id, username: 'bob' },
    ],
    list_items: [],
    recommendations: [],
    notifications: [],
  })
})

describe('POST /api/lists/[id] — añadir título', () => {
  it('no cambia una fila existente con un mediaCache alterado', async () => {
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req('http://localhost/api/lists/l1', { mediaId: 'movie_550', mediaCache: POISON }), {
      params: Promise.resolve({ id: 'l1' }),
    })
    expect(res.status).toBe(201)
    expect(state.db.tables.media).toEqual([REAL_ROW])
    expect(state.db.writes.filter((w) => w.table === 'media' && w.client === 'user')).toEqual([])
  })

  it('un título nuevo se crea desde el proveedor', async () => {
    state.db.tables.media = []
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req('http://localhost/api/lists/l1', { mediaId: 'movie_550', mediaCache: POISON }), {
      params: Promise.resolve({ id: 'l1' }),
    })
    expect(res.status).toBe(201)
    expect(state.db.tables.media[0].title).toBe('El club de la lucha')
    expect(state.db.tables.list_items).toHaveLength(1)
  })

  it('si el proveedor no responde para un título nuevo → 502 sin item huérfano', async () => {
    state.db.tables.media = []
    getMovieMock.mockRejectedValue(new Error('down'))
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req('http://localhost/api/lists/l1', { mediaId: 'movie_550', mediaCache: POISON }), {
      params: Promise.resolve({ id: 'l1' }),
    })
    expect(res.status).toBe(502)
    expect(state.db.tables.list_items).toEqual([])
  })
})

describe('POST /api/recommendations', () => {
  it('no cambia una fila existente y la notificación lleva el título del catálogo', async () => {
    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(
      req('http://localhost/api/recommendations', {
        toUserId: FRIEND.id,
        mediaId: 'movie_550',
        mediaCache: POISON,
      })
    )
    expect(res.status).toBe(201)
    expect(state.db.tables.media).toEqual([REAL_ROW])
    const notification = state.db.tables.notifications[0] as { payload: { mediaTitle: string } }
    expect(notification.payload.mediaTitle).toBe('El club de la lucha')
  })

  it('un título nuevo se crea desde el proveedor', async () => {
    state.db.tables.media = []
    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(
      req('http://localhost/api/recommendations', { toUserId: FRIEND.id, mediaId: 'movie_550', mediaCache: POISON })
    )
    expect(res.status).toBe(201)
    expect(state.db.tables.media[0].title).toBe('El club de la lucha')
    expect(state.db.writes.filter((w) => w.table === 'media').map((w) => w.client)).toEqual(['admin'])
  })
})
