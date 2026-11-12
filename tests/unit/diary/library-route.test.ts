// ============================================================
// F-24 · POST /api/library con y sin RATING_SCALE_10, antes y después de la
// migración 20261208240001 (columna o tabla inexistente → se degrada).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const upserts: Record<string, unknown>[] = []
const upsertResults: Array<{ data: unknown; error: unknown }> = []
const logInserts: Record<string, unknown>[] = []
const logResults: Array<{ data: unknown; error: unknown }> = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'user_media') {
        return {
          upsert: (row: Record<string, unknown>) => {
            upserts.push(row)
            return { select: () => ({ single: async () => upsertResults.shift() ?? { data: null, error: { message: 'x' } } }) }
          },
        }
      }
      if (table === 'user_media_logs') {
        return {
          insert: (row: Record<string, unknown>) => {
            logInserts.push(row)
            return { select: () => ({ single: async () => logResults.shift() ?? { data: null, error: { message: 'x' } } }) }
          },
        }
      }
      throw new Error(`tabla inesperada ${table}`)
    },
  }),
}))
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  upsertMediaFromProvider: async () => ({ ok: true, id: 'movie_550', title: 'Fight Club', created: false }),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))
vi.mock('@/lib/analytics/track', () => ({ track: async () => undefined }))

const USER = { id: '00000000-0000-4000-8000-000000000001' }
const ROW = {
  id: 'e1', user_id: USER.id, media_id: 'movie_550', status: 'completed', score: 5, rating10: 10,
  watched_at: '2026-10-20', episode_progress: null, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z',
}
const MIGRATED_ROW = { ...ROW, rating10: '9.0', favorite: true }

function post(body: unknown) {
  return new Request('http://localhost/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function call(body: unknown) {
  const { POST } = await import('@/app/api/library/route')
  const res = await POST(post(body))
  // Contrato de la fase 7: `{ data }` si sale bien, `{ error }` si no.
  const payload = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>
  return { status: res.status, json: payload.data ?? payload }
}

beforeEach(() => {
  upserts.length = 0
  upsertResults.length = 0
  logInserts.length = 0
  logResults.length = 0
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sin la bandera (hoy)', () => {
  it('un cliente antiguo con score 5 → escribe rating10 10, nunca score (ni favorite ni diario)', async () => {
    upsertResults.push({ data: ROW, error: null })
    const { status, json } = await call({ mediaId: 'movie_550', status: 'completed', score: 5, log: { review: 'x' } })
    expect(status).toBe(200)
    expect(upserts[0]).toEqual({
      // Saneamiento 1.2: lo que no llega (fecha, progreso) no se manda.
      user_id: USER.id, media_id: 'movie_550', status: 'completed', rating10: 10,
    })
    expect(logInserts).toHaveLength(0)
    expect(json.log).toBeNull()
    // La respuesta trae la nota que rellena el disparador (rating10) y favorito apagado.
    expect(json.entry).toMatchObject({ score: 5, rating10: 10, favorite: false })
  })

  it('una nota fina que llegue se guarda sin pérdida (9), sin score', async () => {
    upsertResults.push({ data: ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'completed', rating10: 9 })
    expect(upserts[0]).toMatchObject({ rating10: 9 })
    expect(upserts[0]).not.toHaveProperty('score')
  })
})

// Saneamiento 1.2: el POST solo cambia lo que trae el cuerpo. Antes un
// { mediaId, status } (Añadir franquicia, un cambio de estado) dejaba a null
// la nota, la fecha y el progreso de una entrada que ya existía.
describe('upsert parcial (saneamiento 1.2)', () => {
  it('solo estado: no manda nota, fecha ni progreso', async () => {
    upsertResults.push({ data: ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'pending' })
    expect(upserts[0]).toEqual({ user_id: USER.id, media_id: 'movie_550', status: 'pending' })
  })

  it('solo estado con la escala de 10: tampoco toca rating10 ni favorito', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    upsertResults.push({ data: ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'completed' })
    expect(upserts[0]).toEqual({ user_id: USER.id, media_id: 'movie_550', status: 'completed' })
  })

  it('null explícito sí borra (el diálogo sustituye la entrada entera)', async () => {
    upsertResults.push({ data: ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'pending', score: null, watchedAt: null, episodeProgress: null })
    expect(upserts[0]).toMatchObject({ rating10: null, watched_at: null, progress_season: null, progress_episode: null })
    expect(upserts[0]).not.toHaveProperty('episode_progress')
  })

  it('el apunte del diario sin nota propia ni de la entrada va con null', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    upsertResults.push({ data: ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'completed', log: { review: 'x' } })
    expect(logInserts[0]).toMatchObject({ rating10: null })
  })
})

describe('con RATING_SCALE_10=1', () => {
  beforeEach(() => vi.stubEnv('RATING_SCALE_10', '1'))

  it('guarda rating10 (sin pérdida, nunca score), favorito y el apunte del diario', async () => {
    upsertResults.push({ data: MIGRATED_ROW, error: null })
    logResults.push({
      data: {
        id: 'l1', user_id: USER.id, media_id: 'movie_550', watched_on: '2026-10-20', rewatch: true, rating10: '9.0',
        review: 'Mejor la segunda vez', spoiler: false, private_note: null, created_at: 'x', updated_at: 'x',
      },
      error: null,
    })
    const { status, json } = await call({
      mediaId: 'movie_550', status: 'completed', rating10: 9, favorite: true, watchedAt: '2026-10-20',
      log: { rewatch: true, review: 'Mejor la segunda vez' },
    })
    expect(status).toBe(200)
    expect(upserts[0]).toMatchObject({ rating10: 9, favorite: true })
    expect(upserts[0]).not.toHaveProperty('score')
    expect(logInserts[0]).toEqual({
      user_id: USER.id, media_id: 'movie_550', watched_on: '2026-10-20', rewatch: true, rating10: 9,
      review: 'Mejor la segunda vez', spoiler: false, private_note: null,
    })
    expect(json.entry).toMatchObject({ rating10: 9, score: 5, favorite: true })
    expect(json.log).toMatchObject({ id: 'l1', rating10: 9, rewatch: true, watchedOn: '2026-10-20' })
  })

  it('un cliente antiguo que manda score 3 → rating10 6', async () => {
    upsertResults.push({ data: { ...ROW, score: 3, rating10: 6 }, error: null })
    await call({ mediaId: 'movie_550', status: 'completed', score: 3 })
    expect(upserts[0]).toMatchObject({ rating10: 6 })
    expect(upserts[0]).not.toHaveProperty('score')
  })

  it('sin favorite en el cuerpo no lo toca (no lo apaga)', async () => {
    upsertResults.push({ data: MIGRATED_ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'completed', rating10: 9 })
    expect(upserts[0]).not.toHaveProperty('favorite')
  })

  it('rating10 null quita la nota (score lo vacía el disparador)', async () => {
    upsertResults.push({ data: { ...ROW, score: null, rating10: null }, error: null })
    await call({ mediaId: 'movie_550', status: 'pending', rating10: null })
    expect(upserts[0]).toMatchObject({ rating10: null })
    expect(upserts[0]).not.toHaveProperty('score')
  })

  it('la fecha del apunte, si no llega, es la de la entrada o hoy', async () => {
    upsertResults.push({ data: MIGRATED_ROW, error: null })
    await call({ mediaId: 'movie_550', status: 'completed', rating10: 9, log: {} })
    expect(logInserts[0].watched_on).toBe(new Date().toISOString().slice(0, 10))
  })

  it('si el apunte falla, la entrada queda guardada y se avisa (logFailed)', async () => {
    upsertResults.push({ data: MIGRATED_ROW, error: null })
    logResults.push({ data: null, error: { code: '23514', message: 'check' } })
    const { status, json } = await call({ mediaId: 'movie_550', status: 'completed', rating10: 9, log: { review: 'x' } })
    expect(status).toBe(200)
    expect(json.entry).toBeTruthy()
    expect(json.logFailed).toBe(true)
  })

  it('otro error de base sigue siendo 500 (no se confunde con "sin migrar")', async () => {
    upsertResults.push({ data: null, error: { code: '23503', message: 'fk' } })
    const { status } = await call({ mediaId: 'movie_550', status: 'completed', rating10: 9 })
    expect(status).toBe(500)
    expect(upserts).toHaveLength(1)
  })
})

describe('validación (con y sin bandera)', () => {
  it.each([
    [{ rating10: 7.3 }, 'rating10 must be'],
    [{ rating10: 0 }, 'rating10 must be'],
    [{ rating10: 11 }, 'rating10 must be'],
    [{ favorite: 'sí' }, '"field":"favorite"'],
    [{ log: { watchedOn: 'ayer' } }, 'log.watchedOn'],
    [{ log: { review: 'a'.repeat(5001) } }, 'log.review is too long'],
  ])('%j → 400', async (extra, message) => {
    const { status, json } = await call({ mediaId: 'movie_550', status: 'completed', ...extra })
    expect(status).toBe(400)
    expect(JSON.stringify(json.error)).toContain(message)
    expect(upserts).toHaveLength(0)
  })
})
