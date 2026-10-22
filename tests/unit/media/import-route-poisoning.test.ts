// ============================================================
// KULTURA — Regresión SEG-2 en la importación (`POST /api/account/import`)
//
// La importación hacía upsert en `media` con el título y la portada del JSON
// SUBIDO por el usuario: bastaba editar el fichero para renombrar títulos de
// todos. Ahora las filas existentes no se tocan y las nuevas salen del
// proveedor.
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

const REAL_ROW = {
  id: 'movie_550',
  external_id: '550',
  type: 'movie',
  title: 'El club de la lucha',
  poster: 'https://image.tmdb.org/t/p/w500/real.jpg',
  year: 1999,
  metadata: { genres: ['Drama'] },
}

function req(body: unknown) {
  return new Request('http://localhost/api/account/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', referer: 'https://kulturaapp.vercel.app/es/settings' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getMovieMock.mockImplementation(async (id: number) => ({
    id,
    title: `Peli ${id}`,
    original_title: `Movie ${id}`,
    overview: '',
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: '2001-01-01',
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 7,
  }))
  state.db = createFakeDb({ media: [{ ...REAL_ROW }], user_media: [], lists: [], list_items: [] })
})

describe('POST /api/account/import — catálogo solo desde el servidor', () => {
  it('un fichero con títulos alterados no cambia las filas existentes', async () => {
    const { POST } = await import('@/app/api/account/import/route')
    const res = await POST(
      req({
        library: [
          { mediaId: 'movie_550', status: 'completed', title: 'ENVENENADO', poster: 'https://evil.example/x.png', year: 1 },
        ],
      }) as never
    )

    expect(res.status).toBe(200)
    expect(state.db.tables.media).toEqual([REAL_ROW])
    expect(state.db.writes.filter((w) => w.table === 'media' && w.client === 'user')).toEqual([])
    expect(state.db.tables.user_media).toHaveLength(1)
  })

  it('los títulos que no estaban en el catálogo se crean desde el proveedor, no desde el fichero', async () => {
    const { POST } = await import('@/app/api/account/import/route')
    const res = await POST(
      req({ library: [{ mediaId: 'movie_13', status: 'pending', title: 'ENVENENADO' }] }) as never
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.libraryImported).toBe(1)
    const row = state.db.tables.media.find((r) => r.id === 'movie_13')!
    expect(row.title).toBe('Peli 13')
    expect((row.metadata as { genres: string[] }).genres).toEqual(['Drama'])
  })

  it('lo que el proveedor no resuelve se omite y se informa (reimportar lo completa)', async () => {
    getMovieMock.mockRejectedValue(new Error('TMDB down'))
    const { POST } = await import('@/app/api/account/import/route')
    const res = await POST(
      req({
        library: [
          { mediaId: 'movie_550', status: 'completed' },
          { mediaId: 'movie_13', status: 'pending' },
        ],
      }) as never
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.libraryImported).toBe(1)
    expect(body.libraryUnresolved).toBe(1)
    expect(state.db.tables.user_media.map((r) => r.media_id)).toEqual(['movie_550'])
    expect(state.db.tables.media).toEqual([REAL_ROW])
  })
})
