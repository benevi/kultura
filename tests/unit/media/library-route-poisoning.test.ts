// ============================================================
// KULTURA — Regresión SEG-2: el catálogo `media` no se escribe con lo que manda
// el cliente.
//
// Antes, `POST /api/library` hacía upsert en `media` con `mediaCache` (título,
// portada, sinopsis) y SIN `ignoreDuplicates`: cualquier usuario renombraba un
// título para todos (bibliotecas, listas públicas, recomendaciones).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb, fakeClient, type FakeDb } from './fake-supabase'

const { state, getMovieMock } = vi.hoisted(() => ({
  state: { db: null as unknown as FakeDb },
  getMovieMock: vi.fn(),
}))

const USER = { id: 'user-1' }

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
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: vi.fn() }))
vi.mock('@/lib/recommendations/match-score', () => ({ invalidateMatchScoreCache: vi.fn() }))
vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  getMovie: getMovieMock,
}))

function tmdbMovie(over: Record<string, unknown> = {}) {
  return {
    id: 550,
    title: 'El club de la lucha',
    original_title: 'Fight Club',
    overview: 'Un oficinista insomne…',
    poster_path: '/real.jpg',
    backdrop_path: '/real-bd.jpg',
    release_date: '1999-10-15',
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 8.4,
    ...over,
  }
}

const POISON = {
  externalId: '550',
  type: 'movie',
  title: 'TÍTULO ENVENENADO — visita phishing.example',
  poster: 'https://lh3.googleusercontent.com/attacker.png',
  synopsis: 'texto ofensivo',
  genres: ['Spam'],
}

function post(body: unknown, referer = 'https://kulturaapp.vercel.app/es/media/movie/550') {
  return new Request('http://localhost/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', referer },
    body: JSON.stringify(body),
  })
}

function mediaRow(id: string) {
  return state.db.tables.media?.find((r) => r.id === id)
}

beforeEach(() => {
  vi.clearAllMocks()
  getMovieMock.mockResolvedValue(tmdbMovie())
  state.db = createFakeDb({
    media: [
      {
        id: 'movie_550',
        external_id: '550',
        type: 'movie',
        title: 'El club de la lucha',
        poster: 'https://image.tmdb.org/t/p/w500/real.jpg',
        synopsis: 'Un oficinista insomne…',
        metadata: { genres: ['Drama'] },
      },
    ],
    user_media: [],
  })
})

describe('POST /api/library — catálogo solo desde el servidor (SEG-2)', () => {
  it('un mediaCache alterado no cambia el título, la portada ni la sinopsis de una fila existente', async () => {
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(post({ mediaId: 'movie_550', status: 'completed', mediaCache: POISON }))

    expect(res.status).toBe(200)
    const row = mediaRow('movie_550')!
    expect(row.title).toBe('El club de la lucha')
    expect(row.poster).toBe('https://image.tmdb.org/t/p/w500/real.jpg')
    expect(row.synopsis).toBe('Un oficinista insomne…')
    expect(row.metadata).toEqual({ genres: ['Drama'] })
    // Ni siquiera se intenta escribir `media` con el cliente del usuario.
    expect(state.db.writes.filter((w) => w.table === 'media' && w.client === 'user')).toEqual([])
  })

  it('un título nuevo se crea con la ficha del proveedor, no con la del cliente, y con géneros', async () => {
    state.db.tables.media = []
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(post({ mediaId: 'movie_550', status: 'pending', mediaCache: POISON }))

    expect(res.status).toBe(200)
    expect(getMovieMock).toHaveBeenCalledWith(550, 'es')
    const row = mediaRow('movie_550')!
    expect(row.title).toBe('El club de la lucha')
    expect(row.poster).toBe('https://image.tmdb.org/t/p/w500/real.jpg')
    expect(row.year).toBe(1999)
    // El match score depende de esto (nota de VERIF-A sobre library/route.ts).
    expect((row.metadata as { genres: string[] }).genres).toEqual(['Drama'])
    expect(state.db.writes.filter((w) => w.table === 'media').map((w) => w.client)).toEqual(['admin'])
    expect(state.db.tables.user_media).toHaveLength(1)
  })

  it('el idioma del título nuevo sale de la página desde la que se guarda', async () => {
    state.db.tables.media = []
    const { POST } = await import('@/app/api/library/route')
    await POST(post({ mediaId: 'movie_550', status: 'pending' }, 'https://kulturaapp.vercel.app/en/media/movie/550'))
    expect(getMovieMock).toHaveBeenCalledWith(550, 'en')
  })

  it('una fila existente sin géneros se completa SOLO en metadata.genres, desde el proveedor', async () => {
    state.db.tables.media[0].metadata = { genres: [] }
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(post({ mediaId: 'movie_550', status: 'completed', mediaCache: POISON }))

    expect(res.status).toBe(200)
    const row = mediaRow('movie_550')!
    expect(row.title).toBe('El club de la lucha')
    expect((row.metadata as { genres: string[] }).genres).toEqual(['Drama'])
    expect((row.metadata as { genresSyncedAt?: string }).genresSyncedAt).toBeTypeOf('string')
  })

  it('si el proveedor no responde para un título nuevo, 502 y no se crea nada', async () => {
    state.db.tables.media = []
    getMovieMock.mockRejectedValue(new Error('TMDB down'))
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(post({ mediaId: 'movie_550', status: 'pending', mediaCache: POISON }))

    expect(res.status).toBe(502)
    expect(state.db.tables.media).toEqual([])
    expect(state.db.tables.user_media).toEqual([])
  })

  it('un id con forma imposible para su tipo → 400 sin llamar al proveedor', async () => {
    const { POST } = await import('@/app/api/library/route')
    const res = await POST(post({ mediaId: 'movie_../../x', status: 'pending' }))
    expect(res.status).toBe(400)
    expect(getMovieMock).not.toHaveBeenCalled()
  })
})
