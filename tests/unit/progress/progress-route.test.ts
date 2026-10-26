// ============================================================
// F-27 · /api/library/progress: «marcar siguiente» y «completar», antes y
// después de la migración 20261215270001 y con o sin PROGRESS_V2. TMDB va
// con fixtures de la API oficial (el proxy de este entorno lo bloquea).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TV_GOT, TV_GOT_S1, TV_TLOU } from './fixtures/tmdb'

const mockGetUser = vi.fn()
const updates: Record<string, unknown>[] = []
const logInserts: Record<string, unknown>[] = []
let entry: Record<string, unknown> | null = null
let updateResults: Array<{ data: unknown; error: unknown }> = []
let probeError: unknown = null
let logResult: { data: unknown; error: unknown } = { data: null, error: null }
let tv: unknown = TV_GOT
const getTV = vi.fn(async () => tv)
const providerFetch = vi.fn(async () => TV_GOT_S1)
const resolveMediaItem = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'user_media') {
        return {
          select: (cols: string) => {
            if (cols === 'progress_episode') return { limit: async () => ({ data: [], error: probeError }) }
            const q = { eq: () => q, maybeSingle: async () => ({ data: entry, error: null }) }
            return q
          },
          update: (row: Record<string, unknown>) => {
            updates.push(row)
            const result = () => updateResults.shift() ?? { data: { ...entry, ...row }, error: null }
            const q = {
              eq: () => q,
              select: () => ({ single: async () => result() }),
              then: (resolve: (v: unknown) => void) => resolve(result()),
            }
            return q
          },
        }
      }
      if (table === 'user_media_logs') {
        return {
          insert: (row: Record<string, unknown>) => {
            logInserts.push(row)
            return { select: () => ({ single: async () => logResult }) }
          },
        }
      }
      throw new Error(`tabla inesperada ${table}`)
    },
  }),
}))
vi.mock('@/lib/api/tmdb', () => ({ getTV }))
vi.mock('@/lib/api/http', () => ({ providerFetch }))
vi.mock('@/lib/env.server', () => ({ env: { TMDB_API_KEY: 'k' } }))
vi.mock('@/lib/media/resolve-item', () => ({ resolveMediaItem }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  LIMITS: { library: { windowMs: 60_000, max: 30 } },
}))
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: vi.fn() }))
vi.mock('@/lib/recommendations/match-score', () => ({ invalidateMatchScoreCache: vi.fn() }))

const USER = { id: '00000000-0000-4000-8000-000000000001' }
const COLUMNS = {
  progress_season: null, progress_episode: null, progress_chapter: null, progress_volume: null,
  progress_page: null, progress_percent: null, progress_hours: null, progress_total: null,
}
const BASE = {
  id: 'e1', user_id: USER.id, status: 'in_progress', score: null, watched_at: null,
  created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z',
}
const legacyTv = (ep: Record<string, number>) => ({ ...BASE, media_id: 'tv_1399', episode_progress: ep })
const migratedTv = (season: number, episode: number) => ({
  ...BASE, media_id: 'tv_1399', ...COLUMNS, progress_season: season, progress_episode: episode, progress_total: 10,
  episode_progress: { season, episode, total: 10 },
})

async function post(body: unknown) {
  const { POST } = await import('@/app/api/library/progress/route')
  const res = await POST(new Request('http://localhost/api/library/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

async function get(mediaId: string) {
  const { GET } = await import('@/app/api/library/progress/route')
  const res = await GET(new Request(`http://localhost/api/library/progress?mediaId=${mediaId}`))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  updates.length = 0
  logInserts.length = 0
  updateResults = []
  probeError = null
  logResult = { data: null, error: null }
  tv = TV_GOT
  entry = null
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sesión y validación', () => {
  it('sin sesión, 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await post({ mediaId: 'tv_1399', action: 'next' })).status).toBe(401)
  })

  it('mediaId mal formado o acción desconocida, 400', async () => {
    expect((await post({ mediaId: 'tv-1399', action: 'next' })).status).toBe(400)
    expect((await post({ mediaId: 'tv_1399', action: 'skip' })).status).toBe(400)
    expect((await post({ mediaId: 'tv_1399', action: 'complete', watchedOn: 'ayer' })).status).toBe(400)
  })

  it('título que no está en la biblioteca, 404; película, 400', async () => {
    expect((await post({ mediaId: 'tv_1399', action: 'next' })).status).toBe(404)
    entry = { ...BASE, media_id: 'movie_550', episode_progress: null }
    expect((await post({ mediaId: 'movie_550', action: 'next' })).status).toBe(400)
  })
})

describe('antes de la migración (o sin PROGRESS_V2): solo episodios, en el jsonb de siempre', () => {
  it('serie: T1·E3 → T1·E4 en episode_progress', async () => {
    entry = legacyTv({ season: 1, episode: 3 })
    const { status, json } = await post({ mediaId: 'tv_1399', action: 'next' })
    expect(status).toBe(200)
    expect(updates[0]).toEqual({ episode_progress: { season: 1, episode: 4 } })
    expect(json).toMatchObject({ progress: { season: 1, episode: 4 }, finished: false, caughtUp: false })
  })

  it('fin de temporada según TMDB: T1·E10 → T2·E1', async () => {
    entry = legacyTv({ season: 1, episode: 10 })
    await post({ mediaId: 'tv_1399', action: 'next' })
    expect(updates[0]).toEqual({ episode_progress: { season: 2, episode: 1 } })
  })

  it('un pendiente pasa a «En progreso» al marcar el primer episodio', async () => {
    entry = { ...legacyTv({ episode: 1 }), status: 'pending', episode_progress: null }
    const { json } = await post({ mediaId: 'tv_1399', action: 'next' })
    expect(updates[0]).toEqual({ episode_progress: { season: 1, episode: 1 }, status: 'in_progress' })
    expect(json.status).toBe('in_progress')
  })

  it('libros y juegos sin la migración: 409 progress_unavailable (no se guarda nada)', async () => {
    entry = { ...BASE, media_id: 'book_OL1W', episode_progress: null }
    const res = await post({ mediaId: 'book_OL1W', action: 'next' })
    expect(res.status).toBe(409)
    expect(res.json.error).toBe('progress_unavailable')
    expect(updates).toHaveLength(0)
  })

  it('con PROGRESS_V2 pero sin columnas en la fila, sigue en el jsonb', async () => {
    vi.stubEnv('PROGRESS_V2', '1')
    entry = legacyTv({ season: 2, episode: 2 })
    await post({ mediaId: 'tv_1399', action: 'next' })
    expect(updates[0]).toEqual({ episode_progress: { season: 2, episode: 3 } })
  })
})

describe('después de la migración con PROGRESS_V2', () => {
  beforeEach(() => vi.stubEnv('PROGRESS_V2', '1'))

  it('serie: escribe las columnas (con el total de la temporada), no el jsonb', async () => {
    entry = migratedTv(6, 10)
    const { json } = await post({ mediaId: 'tv_1399', action: 'next' })
    expect(updates[0]).toEqual({ ...COLUMNS, progress_season: 7, progress_episode: 1, progress_total: 7 })
    expect(json.progress).toEqual({ season: 7, episode: 1, total: 7 })
  })

  it('último episodio de una serie terminada: finished para proponer «Completado»', async () => {
    entry = migratedTv(8, 5)
    const { json } = await post({ mediaId: 'tv_1399', action: 'next' })
    expect(json).toMatchObject({ finished: true, caughtUp: false, progress: { season: 8, episode: 6 } })
  })

  it('serie en emisión al día: no escribe y responde caughtUp', async () => {
    tv = TV_TLOU
    entry = { ...migratedTv(2, 7), media_id: 'tv_100088' }
    const { json } = await post({ mediaId: 'tv_100088', action: 'next' })
    expect(updates).toHaveLength(0)
    expect(json).toMatchObject({ caughtUp: true, finished: false })
  })

  it('libro: +10 páginas con el total de la ficha', async () => {
    resolveMediaItem.mockResolvedValueOnce({ id: 'book_OL1W', type: 'book', title: 'Dune', metadata: { pageCount: 350 } })
    entry = { ...BASE, media_id: 'book_OL1W', ...COLUMNS, progress_page: 120, episode_progress: { page: 120 } }
    const { json } = await post({ mediaId: 'book_OL1W', action: 'next' })
    expect(updates[0]).toEqual({ ...COLUMNS, progress_page: 130, progress_total: 350 })
    expect(json.progress).toEqual({ page: 130, total: 350 })
  })

  it('juego: +1 hora (la media de RAWG como total) aunque el proveedor no responda', async () => {
    resolveMediaItem.mockResolvedValueOnce(null)
    entry = { ...BASE, media_id: 'game_274755', ...COLUMNS, progress_hours: 12.5, progress_total: 22, episode_progress: { hours: 12.5, total: 22 } }
    await post({ mediaId: 'game_274755', action: 'next' })
    expect(updates[0]).toEqual({ ...COLUMNS, progress_hours: 13.5, progress_total: 22 })
  })

  it('si la base dice que faltan las columnas (PGRST204), reintenta en el jsonb', async () => {
    entry = migratedTv(1, 1)
    updateResults = [{ data: null, error: { code: 'PGRST204' } }]
    const { status } = await post({ mediaId: 'tv_1399', action: 'next' })
    expect(status).toBe(200)
    expect(updates[1]).toEqual({ episode_progress: { season: 1, episode: 2 } })
  })

  it('otro error de base es un 500 (la interfaz revierte)', async () => {
    entry = migratedTv(1, 1)
    updateResults = [{ data: null, error: { code: '23514', message: 'check' } }]
    expect((await post({ mediaId: 'tv_1399', action: 'next' })).status).toBe(500)
  })
})

describe('completar', () => {
  it('pasa a «Completado» con la fecha y, sin el diario activo, no apunta nada', async () => {
    entry = migratedTv(8, 6)
    const { status, json } = await post({ mediaId: 'tv_1399', action: 'complete', log: true, watchedOn: '2026-10-25' })
    expect(status).toBe(200)
    expect(updates[0]).toEqual({ status: 'completed', watched_at: '2026-10-25' })
    expect(logInserts).toHaveLength(0)
    expect(json.log).toBeNull()
  })

  it('con el diario (RATING_SCALE_10) apunta el visionado con la nota de la entrada', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    entry = { ...migratedTv(8, 6), rating10: 9 }
    logResult = {
      data: { id: 'l1', media_id: 'tv_1399', watched_on: '2026-10-25', rewatch: false, rating10: 9, review: null, spoiler: false, private_note: null, created_at: 'x' },
      error: null,
    }
    const { json } = await post({ mediaId: 'tv_1399', action: 'complete', log: true, watchedOn: '2026-10-25' })
    expect(logInserts[0]).toMatchObject({ media_id: 'tv_1399', watched_on: '2026-10-25', rewatch: false, rating10: 9 })
    expect(json.log).toMatchObject({ id: 'l1' })
  })

  it('diario sin su migración: completa igual y no avisa de fallo', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    entry = migratedTv(8, 6)
    logResult = { data: null, error: { code: '42P01' } }
    const { json } = await post({ mediaId: 'tv_1399', action: 'complete', log: true })
    expect(json.logFailed).toBeUndefined()
  })
})

describe('GET: estado y plan para el diálogo', () => {
  it('serie: plan de TMDB y el siguiente episodio con su nombre', async () => {
    entry = legacyTv({ season: 1, episode: 2 })
    const { json } = await get('tv_1399')
    expect(json).toMatchObject({
      enabled: false,
      kind: 'tv',
      progress: { season: 1, episode: 2 },
      total: 10,
      next: { season: 1, episode: 3, name: 'Lord Nieve' },
    })
    expect((json.plan as { seasons: unknown[] }).seasons).toHaveLength(8)
  })

  it('enabled solo con PROGRESS_V2 y las columnas (sonda si el título no está)', async () => {
    vi.stubEnv('PROGRESS_V2', '1')
    entry = null
    expect((await get('book_OL1W')).json.enabled).toBe(true)
    probeError = { code: '42703' }
    expect((await get('book_OL1W')).json.enabled).toBe(false)
  })

  it('película: sin progreso', async () => {
    const { json } = await get('movie_550')
    expect(json).toMatchObject({ kind: null, enabled: false })
  })
})
