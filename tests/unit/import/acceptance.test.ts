// @vitest-environment node
// F-26 — Criterios de aceptación medibles desde aquí, de punta a punta:
// archivo → lector del navegador → lotes → ruta → emparejado → biblioteca.
//   1. ratings.csv de Letterboxd de 500 filas → ≥ 90 % emparejado (meta 95 %)
//      y NINGÚN emparejado con la película equivocada.
//   2. 100 títulos importados en < 2 min con latencias de proveedor simuladas.
// Los proveedores van simulados (el proxy los bloquea); la forma de sus
// respuestas es la documentada (fixtures/providers.ts) y se verifica contra
// producción con scripts/import-verify.sh.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFakeDb, fakeClient, prng, sleep, type FakeDb } from './helpers'
import { buildCatalog, buildRatingsCsv, searchCatalog } from './fixtures/letterboxd-fixture'
import { FILMS } from './fixtures/films'

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  latency: null as null | (() => number),
  searches: 0,
  ensureCalls: 0,
}))
const catalog = buildCatalog()

vi.mock('@/lib/supabase/server', async () => {
  const { fakeClient: fc } = await import('./helpers')
  return {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1', app_metadata: {} } }, error: null }) },
      from: (t: string) => fc(state.db).from(t),
    }),
  }
})
vi.mock('@/lib/supabase/admin', async () => {
  const { fakeClient: fc } = await import('./helpers')
  return { createAdminClient: () => fc(state.db) }
})
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0, remaining: 100 }),
}))
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: vi.fn() }))
vi.mock('@/lib/recommendations/match-score', () => ({ invalidateMatchScoreCache: vi.fn() }))
vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  searchMovies: async (query: string) => {
    state.searches++
    if (state.latency) await sleep(state.latency())
    return searchCatalog(catalog.movies, query)
  },
}))
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()
  const { mapLimit } = await import('@/lib/import/server/budget')
  return {
    ...actual,
    // La ficha en el idioma de la persona (getMovie): una petición por título nuevo.
    ensureMediaRows: async (ids: string[], opts: { concurrency?: number } = {}) => {
      const available = new Set<string>()
      await mapLimit(ids, opts.concurrency ?? 4, async (id) => {
        state.ensureCalls++
        if (state.latency) await sleep(state.latency())
        const m = catalog.movies.find((x) => `movie_${x.id}` === id)
        if (!m) return
        state.db.tables.media.push({ id, title: m.title, year: Number(m.release_date.slice(0, 4)) })
        available.add(id)
      })
      return { available, unresolved: ids.filter((id) => !available.has(id)) }
    },
  }
})

import { POST } from '@/app/api/account/import/external/route'
import { parseImportFiles } from '@/lib/import/parse-file'
import { runImport, type SendBatch } from '@/lib/import/run'

const send: SendBatch = async (request) => {
  const res = await POST(
    new Request('http://localhost/api/account/import/external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', referer: 'http://localhost/es/settings/import' },
      body: JSON.stringify(request),
    }) as never
  )
  if (res.ok) return { ok: true, data: await res.json() }
  return { ok: false, status: res.status }
}

const FIXTURE = join(__dirname, 'fixtures', 'letterboxd-ratings-500.csv')

describe('aceptación F-26', () => {
  beforeEach(() => {
    state.db = createFakeDb()
    state.latency = null
    state.searches = 0
    state.ensureCalls = 0
  })
  afterEach(() => {
    delete process.env.RATING_SCALE_10
  })

  it('el fixture guardado es el que sale del generador (500 filas con la forma de Letterboxd)', () => {
    const csv = readFileSync(FIXTURE, 'utf8')
    expect(csv).toBe(buildRatingsCsv())
    expect(csv.trim().split('\n')).toHaveLength(501)
    expect(csv.split('\n')[0]).toBe('Date,Name,Year,Letterboxd URI,Rating')
  })

  it('ratings.csv de 500 filas → ≥ 90 % emparejado y ninguno con la película equivocada', async () => {
    process.env.RATING_SCALE_10 = '1'
    const parsed = await parseImportFiles([{ name: 'ratings.csv', bytes: new Uint8Array(readFileSync(FIXTURE)) }])
    expect(parsed.items).toHaveLength(500)

    const end = await runImport({ source: parsed.source, items: parsed.items, send, sleep: async () => undefined })
    expect(end.status).toBe('done')

    let matched = 0
    let wrong = 0
    parsed.items.forEach((item, i) => {
      const r = end.results.get(item.key)!
      expect(item.title).toBe(FILMS[i][0])
      if (r.outcome === 'added') {
        matched++
        if (r.mediaId !== `movie_${catalog.expected[i]}`) wrong++
      } else {
        expect(r.outcome).toBe('unmatched')
      }
    })
    const rate = matched / parsed.items.length
    console.log(`[F-26] emparejado ${matched}/500 = ${(rate * 100).toFixed(1)} %; equivocados: ${wrong}`)
    expect(rate).toBeGreaterThanOrEqual(0.9)
    expect(wrong).toBe(0)

    // En la biblioteca, para el usuario de la sesión, con la nota fina de Letterboxd.
    const rows = state.db.tables.user_media
    expect(rows).toHaveLength(matched)
    expect(rows.every((r) => r.user_id === 'user-1' && r.status === 'completed')).toBe(true)
    const shawshank = rows.find((r) => r.media_id === `movie_${catalog.expected[0]}`)!
    expect(shawshank.rating10).toBe(8) // 4★ en el fixture
    expect(shawshank.score).toBe(4)

    // Reimportar el mismo archivo no duplica ni cambia nada.
    const again = await runImport({ source: parsed.source, items: parsed.items, send, sleep: async () => undefined })
    expect(state.db.tables.user_media).toHaveLength(matched)
    expect(Array.from(again.results.values()).filter((r) => r.outcome === 'kept')).toHaveLength(matched)
  }, 60_000)

  it('100 títulos en < 2 min con latencias de proveedor de 80-300 ms', async () => {
    const rand = prng(7)
    state.latency = () => 80 + rand() * 220
    const parsed = await parseImportFiles([{ name: 'ratings.csv', bytes: new Uint8Array(readFileSync(FIXTURE)) }])
    const items = parsed.items.slice(0, 100)
    const started = Date.now()
    const end = await runImport({ source: parsed.source, items, send })
    const elapsed = Date.now() - started
    const added = Array.from(end.results.values()).filter((r) => r.outcome === 'added').length
    console.log(`[F-26] 100 títulos en ${(elapsed / 1000).toFixed(1)} s (${state.searches} búsquedas, ${state.ensureCalls} fichas)`)
    expect(end.status).toBe('done')
    expect(added).toBeGreaterThanOrEqual(90)
    expect(elapsed).toBeLessThan(120_000)
    // Holgura real: con 6 búsquedas y 4 fichas a la vez, muy por debajo del minuto.
    expect(elapsed).toBeLessThan(30_000)
    // Presupuesto: como mucho una búsqueda y una ficha por título.
    expect(state.searches).toBeLessThanOrEqual(100)
    expect(state.ensureCalls).toBeLessThanOrEqual(100)
  }, 60_000)
})
