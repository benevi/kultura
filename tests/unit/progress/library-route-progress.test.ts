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
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
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
  // Contrato de la fase 7: `{ data }` si sale bien, `{ error }` si no.
  const payload = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>
  return { status: res.status, json: payload.data ?? payload }
}

beforeEach(() => {
  upserts.length = 0
  upsertResults.length = 0
  stored = null
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

const episodeOnly = (row: Record<string, unknown>) =>
  Object.keys(row).filter((k) => k.startsWith('progress_')).sort()

// Saneamiento 6.6: el jsonb episode_progress ya no se escribe. Sin la bandera
// van solo temporada y episodio, en sus columnas; las demás no se mandan (así
// un libro con páginas no las pierde, como antes con el disparador).
describe('sin PROGRESS_V2 (hoy)', () => {
  it('el episodeProgress de siempre va a progress_season y progress_episode', async () => {
    await call({ mediaId: 'tv_1399', status: 'in_progress', episodeProgress: { season: 1, episode: 2 } })
    expect(upserts[0]).toMatchObject({ progress_season: 1, progress_episode: 2 })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
    expect(episodeOnly(upserts[0])).toEqual(['progress_episode', 'progress_season'])
  })

  it('con `progress` de un cliente nuevo, solo la temporada y el episodio', async () => {
    await call({ mediaId: 'tv_1399', status: 'in_progress', progress: { season: 3, episode: 4, total: 10 } })
    expect(upserts[0]).toMatchObject({ progress_season: 3, progress_episode: 4 })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
    expect(upserts[0]).not.toHaveProperty('progress_total')
  })

  it('fila migrada de un libro y la bandera apagada: payload de siempre y la entrada conserva sus páginas', async () => {
    stored = {
      progress_season: null, progress_episode: null, progress_chapter: null, progress_volume: null,
      progress_page: 120, progress_percent: null, progress_hours: null, progress_total: 350,
      progress_updated_at: '2026-10-25T10:00:00Z', episode_progress: { page: 120, total: 350 },
    }
    for (const extra of [{ episodeProgress: null }, { progress: { page: 200, total: 350 } }, {}]) {
      upserts.length = 0
      const { status, json } = await call({ mediaId: 'book_OL1W', status: 'pending', ...extra })
      expect(status).toBe(200)
      expect(upserts[0]).not.toHaveProperty('episode_progress')
      // Saneamiento 1.2: sin progreso en el cuerpo, ni se mandan las columnas.
      if (Object.keys(extra).length === 0) expect(episodeOnly(upserts[0])).toEqual([])
      else expect(upserts[0]).toMatchObject({ progress_season: null, progress_episode: null })
      expect(upserts[0]).not.toHaveProperty('progress_page')
      expect((json.entry as Record<string, unknown>).progress).toEqual({ page: 120, total: 350 })
    }
  })

  it('juego sin bandera: temporada y episodio a null, horas intactas', async () => {
    await call({ mediaId: 'game_3498', status: 'in_progress', episodeProgress: null })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
    expect(upserts[0]).toMatchObject({ progress_season: null, progress_episode: null })
    expect(episodeOnly(upserts[0])).toEqual(['progress_episode', 'progress_season'])
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

})
