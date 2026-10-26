// @vitest-environment node
// F-26 — POST /api/account/import/external: sesión, demo, límite por usuario,
// tamaño del lote, validación y nada del archivo en los logs.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb, type FakeDb } from './helpers'
import { tmdbMovie, tmdbSearch } from './fixtures/providers'

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'user-1', app_metadata: {} } as { id: string; app_metadata: Record<string, unknown> } | null,
  rl: { allowed: true, retryAfterSeconds: 0, remaining: 10 },
  rlKeys: [] as string[],
  logs: [] as unknown[],
  invalidated: 0,
}))

vi.mock('@/lib/supabase/server', async () => {
  const { fakeClient } = await import('./helpers')
  return {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : { message: 'no' } }) },
      from: (t: string) => fakeClient(state.db).from(t),
    }),
  }
})
vi.mock('@/lib/supabase/admin', async () => {
  const { fakeClient } = await import('./helpers')
  return { createAdminClient: () => fakeClient(state.db) }
})
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async (key: string) => {
    state.rlKeys.push(key)
    return state.rl
  },
}))
vi.mock('@/lib/logger', () => ({
  createLogger: () => {
    const push = (...args: unknown[]) => state.logs.push(args)
    return { debug: push, info: push, warn: push, error: push }
  },
}))
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: () => state.invalidated++ }))
vi.mock('@/lib/recommendations/match-score', () => ({ invalidateMatchScoreCache: () => state.invalidated++ }))
vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  searchMovies: async () => tmdbSearch([tmdbMovie(438631, 'Dune', '2021-09-15')]),
}))
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  ensureMediaRows: async (ids: string[]) => {
    for (const id of ids) state.db.tables.media.push({ id, title: 'Dune', year: 2021 })
    return { available: new Set(ids), unresolved: [] }
  },
}))

import { POST } from '@/app/api/account/import/external/route'
import { MAX_BATCH_BYTES } from '@/lib/import/limits'

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request('http://localhost/api/account/import/external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never
  )
}

const SECRET_TITLE = 'Dune'
const valid = {
  source: 'letterboxd',
  items: [
    { key: '0', kind: 'movie', title: SECRET_TITLE, year: 2021, status: 'completed', rating10: 9, watchedAt: '2021-10-01', logs: [{ watchedOn: '2021-10-01', rewatch: false, rating10: 9, review: 'Reseña íntima', spoiler: false }] },
    { key: '1', kind: 'movie', title: '', status: 'completed', rating10: null, watchedAt: null },
  ],
}

describe('POST /api/account/import/external', () => {
  beforeEach(() => {
    state.db = createFakeDb()
    state.user = { id: 'user-1', app_metadata: {} }
    state.rl = { allowed: true, retryAfterSeconds: 0, remaining: 10 }
    state.rlKeys = []
    state.logs = []
    state.invalidated = 0
  })

  it('sin sesión → 401', async () => {
    state.user = null
    expect((await post(valid)).status).toBe(401)
  })

  it('la cuenta demo no puede importar → 403 demo_read_only, sin escribir nada', async () => {
    state.user = { id: 'demo', app_metadata: { demo: true } }
    const res = await post(valid)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'demo_read_only' })
    expect(state.db.tables.user_media).toHaveLength(0)
  })

  it('límite de lotes por usuario (distribuido) → 429 con Retry-After', async () => {
    state.rl = { allowed: false, retryAfterSeconds: 42, remaining: 0 }
    const res = await post(valid)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(state.rlKeys).toEqual(['user-1:import_batch'])
  })

  it('lote demasiado grande → 413; JSON roto, fuente desconocida o más de 50 filas → 400', async () => {
    expect((await post('x'.repeat(MAX_BATCH_BYTES + 1))).status).toBe(413)
    expect((await post(valid, { 'content-length': String(MAX_BATCH_BYTES + 10) })).status).toBe(413)
    expect((await post('{nope')).status).toBe(400)
    expect((await post({ ...valid, source: 'trakt' })).status).toBe(400)
    const many = Array.from({ length: 51 }, (_, i) => ({ ...valid.items[0], key: String(i) }))
    expect((await post({ source: 'letterboxd', items: many })).status).toBe(400)
  })

  it('importa lo válido, marca lo inválido y lo escribe para el usuario de la sesión', async () => {
    const res = await post(valid)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body.results).toEqual([
      { key: '0', outcome: 'added', mediaId: 'movie_438631', by: 'title_year', title: 'Dune', year: 2021 },
      { key: '1', outcome: 'invalid' },
    ])
    expect(state.db.tables.user_media).toEqual([
      expect.objectContaining({ user_id: 'user-1', media_id: 'movie_438631', status: 'completed', score: 5, watched_at: '2021-10-01' }),
    ])
    expect(state.invalidated).toBe(2)
  })

  it('en los logs solo hay recuentos: ni títulos ni reseñas del archivo', async () => {
    await post(valid)
    const dump = JSON.stringify(state.logs)
    expect(dump).toContain('lote importado')
    expect(dump).not.toContain(SECRET_TITLE)
    expect(dump).not.toContain('Reseña íntima')
  })

  it('un fallo de la base al escribir → 500 sin datos del archivo en el log', async () => {
    state.db.errors['user_media.upsert'] = { code: '23503', message: 'fk' }
    const res = await post(valid)
    expect(res.status).toBe(500)
    expect(JSON.stringify(state.logs)).not.toContain(SECRET_TITLE)
  })
})
