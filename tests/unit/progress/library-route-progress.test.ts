// ============================================================
// F-27 · POST /api/library con `progress` (diálogo de biblioteca), con y sin
// PROGRESS_V2 y antes/después de la migración 20261215270001.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const upserts: Record<string, unknown>[] = []
const upsertResults: Array<{ data: unknown; error: unknown }> = []
/** Fila ya guardada en la base (con la migración): el upsert de PostgREST
 * solo cambia las columnas que se mandan, el resto se queda. */
let stored: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row)
        return { select: () => ({ single: async () => upsertResults.shift() ?? { data: { ...ROW, ...(stored ?? {}), ...row }, error: null } }) }
      },
    }),
  }),
}))
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  upsertMediaFromProvider: async () => ({ ok: true, id: 'x', title: 'x', created: false }),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
}))
vi.mock('@/lib/analytics/track', () => ({ track: async () => undefined }))

const USER = { id: '00000000-0000-4000-8000-000000000001' }
const ROW = {
  id: 'e1', user_id: USER.id, media_id: 'book_OL1W', status: 'in_progress', score: null,
  watched_at: null, episode_progress: null, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z',
}

async function call(body: unknown) {
  const { POST } = await import('@/app/api/library/route')
  const res = await POST(new Request('http://localhost/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  upserts.length = 0
  upsertResults.length = 0
  stored = null
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('sin PROGRESS_V2 (hoy)', () => {
  it('el episodeProgress de siempre se guarda igual', async () => {
    await call({ mediaId: 'tv_1399', status: 'in_progress', episodeProgress: { season: 1, episode: 2 } })
    expect(upserts[0].episode_progress).toEqual({ season: 1, episode: 2 })
    expect(upserts[0]).not.toHaveProperty('progress_episode')
  })

  it('con `progress` de un cliente nuevo, la temporada y el episodio van al jsonb', async () => {
    await call({ mediaId: 'tv_1399', status: 'in_progress', progress: { season: 3, episode: 4, total: 10 } })
    expect(upserts[0].episode_progress).toEqual({ season: 3, episode: 4 })
    expect(upserts[0]).not.toHaveProperty('progress_season')
  })

  it('fila migrada de un libro y la bandera apagada: guardar el estado no borra las páginas', async () => {
    stored = {
      progress_season: null, progress_episode: null, progress_chapter: null, progress_volume: null,
      progress_page: 120, progress_percent: null, progress_hours: null, progress_total: 350,
      progress_updated_at: '2026-10-25T10:00:00Z', episode_progress: { page: 120, total: 350 },
    }
    // Un cliente antiguo manda episodeProgress null; uno nuevo, progress (que sin bandera no se escribe).
    for (const extra of [{ episodeProgress: null }, { progress: { page: 200, total: 350 } }, {}]) {
      upserts.length = 0
      const { status, json } = await call({ mediaId: 'book_OL1W', status: 'pending', ...extra })
      expect(status).toBe(200)
      // Ni el jsonb (el disparador lo tomaría como «sin progreso») ni las columnas.
      expect(upserts[0]).not.toHaveProperty('episode_progress')
      expect(Object.keys(upserts[0]).filter((k) => k.startsWith('progress_'))).toEqual([])
      expect((json.entry as Record<string, unknown>).progress).toEqual({ page: 120, total: 350 })
    }
  })

  it('juego sin bandera: tampoco manda episode_progress', async () => {
    await call({ mediaId: 'game_3498', status: 'in_progress', episodeProgress: null })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
  })
})

describe('con PROGRESS_V2', () => {
  beforeEach(() => vi.stubEnv('PROGRESS_V2', '1'))

  it('libro: columnas de progreso; el espejo episode_progress lo pone el disparador', async () => {
    const { json } = await call({ mediaId: 'book_OL1W', status: 'in_progress', progress: { page: 120, total: 350 } })
    expect(upserts[0]).toMatchObject({ progress_page: 120, progress_total: 350, progress_episode: null })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
    expect((json.entry as Record<string, unknown>).progress).toEqual({ page: 120, total: 350 })
  })

  it('progress null borra el progreso (todas las columnas a NULL)', async () => {
    await call({ mediaId: 'book_OL1W', status: 'pending', progress: null })
    expect(upserts[0]).toMatchObject({ progress_page: null, progress_percent: null, progress_total: null })
  })

  it('campo de otro formato o fuera de rango: 400 y no se escribe', async () => {
    expect((await call({ mediaId: 'tv_1399', status: 'in_progress', progress: { page: 3 } })).status).toBe(400)
    expect((await call({ mediaId: 'book_OL1W', status: 'in_progress', progress: { percent: 120 } })).status).toBe(400)
    expect(upserts).toHaveLength(0)
  })

  it('sin la migración (PGRST204): vuelve a escribir episode_progress, como antes', async () => {
    upsertResults.push({ data: null, error: { code: 'PGRST204' } })
    const { status } = await call({ mediaId: 'tv_1399', status: 'in_progress', progress: { season: 1, episode: 5 } })
    expect(status).toBe(200)
    expect(upserts[1]).toMatchObject({ episode_progress: { season: 1, episode: 5 } })
    expect(upserts[1]).not.toHaveProperty('progress_episode')
  })

  it('las dos banderas sin ninguna migración: termina en la fila de siempre', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    upsertResults.push({ data: null, error: { code: 'PGRST204' } }, { data: null, error: { code: 'PGRST204' } })
    const { status } = await call({ mediaId: 'tv_1399', status: 'in_progress', score: 4, progress: { episode: 2 } })
    expect(status).toBe(200)
    expect(upserts).toHaveLength(3)
    expect(upserts[2]).not.toHaveProperty('rating10')
    expect(upserts[2]).not.toHaveProperty('progress_episode')
    expect(upserts[2].episode_progress).toEqual({ episode: 2 })
  })

  it('con la de notas aplicada y sin la de progreso: conserva rating10', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    upsertResults.push({ data: null, error: { code: 'PGRST204' } })
    await call({ mediaId: 'tv_1399', status: 'in_progress', rating10: 9, progress: { episode: 2 } })
    expect(upserts[1]).toMatchObject({ rating10: 9, episode_progress: { episode: 2 } })
    expect(upserts[1]).not.toHaveProperty('progress_episode')
  })
})
