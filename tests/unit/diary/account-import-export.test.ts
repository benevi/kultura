// ============================================================
// F-24 · Export e import del JSON propio con la nota fina, el favorito y el
// diario (ida y vuelta sin pérdida), con y sin RATING_SCALE_10.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb, fakeClient } from '../media/fake-supabase'
import { collectExportSections } from '@/app/api/account/export/collect'

const mockGetUser = vi.fn()
const upserts: unknown[][] = []
const upsertErrors: Array<{ code?: string; message: string } | null> = []
const logInserts: unknown[] = []
let libraryIds: string[] = []
let existingLogs: Array<Record<string, unknown>> = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'user_media') {
        return {
          upsert: async (rows: unknown[]) => {
            upserts.push(rows)
            return { error: upsertErrors.shift() ?? null }
          },
          select: () => ({
            eq: () => ({ in: async (_c: string, ids: string[]) => ({ data: libraryIds.filter((id) => ids.includes(id)).map((media_id) => ({ media_id })), error: null }) }),
          }),
        }
      }
      if (table === 'user_media_logs') {
        return {
          select: () => ({ eq: async () => ({ data: existingLogs, error: null }) }),
          insert: async (rows: unknown[]) => {
            logInserts.push(...rows)
            return { error: null }
          },
        }
      }
      if (table === 'lists') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
      throw new Error(`tabla inesperada ${table}`)
    },
  }),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
}))
vi.mock('@/lib/claude/recommendations', () => ({ invalidateRecCache: vi.fn() }))
vi.mock('@/lib/recommendations/match-score', () => ({ invalidateMatchScoreCache: vi.fn() }))
vi.mock('@/lib/media/upsert-from-provider', () => ({
  ensureMediaRows: async (ids: string[]) => ({ available: new Set(ids), unresolved: [] }),
}))

const ME = '00000000-0000-4000-8000-000000000001'

function importRequest(body: unknown) {
  return new Request('http://localhost/api/account/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

async function runImport(body: unknown) {
  const { POST } = await import('@/app/api/account/import/route')
  const res = await POST(importRequest(body))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const FILE = {
  library: [
    { mediaId: 'movie_1', status: 'completed', score: 5, rating10: 9, favorite: true, watchedAt: '2026-10-01' },
    { mediaId: 'movie_2', status: 'completed', score: 3 }, // export antiguo, sin rating10
  ],
  diary: [
    { mediaId: 'movie_1', watchedOn: '2026-10-01', rewatch: false, rating10: 9, review: 'Obra maestra', spoiler: false, privateNote: 'Con Bea' },
    { mediaId: 'movie_1', watchedOn: '2026-10-20', rewatch: true, rating10: 8.5, review: null, spoiler: false, privateNote: null },
    { mediaId: 'movie_9', watchedOn: '2026-10-20', rewatch: false }, // no está en la biblioteca
    { mediaId: 'movie_1', watchedOn: 'ayer' }, // fecha mala
  ],
}

beforeEach(() => {
  upserts.length = 0
  upsertErrors.length = 0
  logInserts.length = 0
  libraryIds = ['movie_1', 'movie_2']
  existingLogs = []
  mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe('import con RATING_SCALE_10=1', () => {
  beforeEach(() => vi.stubEnv('RATING_SCALE_10', '1'))

  it('rating10 y favorito vuelven tal cual; un export antiguo pasa score × 2', async () => {
    const { status } = await runImport(FILE)
    expect(status).toBe(200)
    expect(upserts[0]).toEqual([
      { user_id: ME, media_id: 'movie_1', status: 'completed', score: 5, watched_at: '2026-10-01', rating10: 9, favorite: true },
      { user_id: ME, media_id: 'movie_2', status: 'completed', score: 3, watched_at: null, rating10: 6, favorite: false },
    ])
  })

  it('reimporta el diario de los títulos de la biblioteca y descarta lo inválido', async () => {
    const { json } = await runImport(FILE)
    expect(json.diaryImported).toBe(2)
    expect(logInserts).toEqual([
      { user_id: ME, media_id: 'movie_1', watched_on: '2026-10-01', rewatch: false, rating10: 9, review: 'Obra maestra', spoiler: false, private_note: 'Con Bea' },
      { user_id: ME, media_id: 'movie_1', watched_on: '2026-10-20', rewatch: true, rating10: 8.5, review: null, spoiler: false, private_note: null },
    ])
  })

  it('reimportar el mismo fichero no duplica apuntes', async () => {
    existingLogs = [
      { media_id: 'movie_1', watched_on: '2026-10-01', rewatch: false, review: 'Obra maestra' },
      { media_id: 'movie_1', watched_on: '2026-10-20', rewatch: true, review: null },
    ]
    const { json } = await runImport(FILE)
    expect(json.diaryImported).toBe(0)
    expect(logInserts).toHaveLength(0)
  })

  it('sin la migración (PGRST204) importa solo score y no toca el diario', async () => {
    upsertErrors.push({ code: 'PGRST204', message: "Could not find the 'rating10' column" })
    const { status, json } = await runImport(FILE)
    expect(status).toBe(200)
    expect(upserts).toHaveLength(2)
    expect(upserts[1]).toEqual([
      { user_id: ME, media_id: 'movie_1', status: 'completed', score: 5, watched_at: '2026-10-01' },
      { user_id: ME, media_id: 'movie_2', status: 'completed', score: 3, watched_at: null },
    ])
    expect(json.diaryImported).toBe(0)
  })
})

describe('import sin la bandera (hoy)', () => {
  it('escribe solo score (de rating10 si viene: 9 → 5, 7,5 → 4) y no importa el diario', async () => {
    const { json } = await runImport({
      library: [{ mediaId: 'movie_1', status: 'completed', score: 3, rating10: 7.5, favorite: true }],
      diary: FILE.diary,
    })
    expect(upserts[0]).toEqual([{ user_id: ME, media_id: 'movie_1', status: 'completed', score: 4, watched_at: null }])
    expect(json.diaryImported).toBe(0)
    expect(logInserts).toHaveLength(0)
  })
})

describe('export', () => {
  it('incluye el diario propio (con la nota personal) y nunca el de otros', async () => {
    const db = createFakeDb({
      user_media_logs: [
        { id: 'l2', user_id: ME, media_id: 'movie_1', watched_on: '2026-10-20', rewatch: true, rating10: '8.5', review: null, spoiler: false, private_note: null, created_at: '2026-10-20T10:00:00Z' },
        { id: 'l1', user_id: ME, media_id: 'movie_1', watched_on: '2026-10-01', rewatch: false, rating10: '9.0', review: 'Obra maestra', spoiler: true, private_note: 'Con Bea', created_at: '2026-10-01T10:00:00Z' },
        { id: 'lx', user_id: 'otro', media_id: 'movie_1', watched_on: '2026-10-05', rewatch: false, rating10: null, review: 'ajena', spoiler: false, private_note: 'secreta', created_at: '2026-10-05T10:00:00Z' },
      ],
    })
    const sections = await collectExportSections(fakeClient(db, 'admin') as never, ME)
    expect(sections.diary).toEqual([
      { id: 'l1', mediaId: 'movie_1', watchedOn: '2026-10-01', rewatch: false, rating10: 9, review: 'Obra maestra', spoiler: true, privateNote: 'Con Bea', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'l2', mediaId: 'movie_1', watchedOn: '2026-10-20', rewatch: true, rating10: 8.5, review: null, spoiler: false, privateNote: null, createdAt: '2026-10-20T10:00:00Z' },
    ])
  })

  it('ida y vuelta: lo que exporta es lo que el import acepta', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    const db = createFakeDb({
      user_media_logs: [
        { id: 'l1', user_id: ME, media_id: 'movie_1', watched_on: '2026-10-01', rewatch: false, rating10: '9.0', review: 'Obra maestra', spoiler: true, private_note: 'Con Bea', created_at: 'c' },
      ],
    })
    const { diary } = await collectExportSections(fakeClient(db, 'admin') as never, ME)
    const { json } = await runImport({ library: [{ mediaId: 'movie_1', status: 'completed', rating10: 9 }], diary })
    expect(json.diaryImported).toBe(1)
    expect(logInserts[0]).toMatchObject({ media_id: 'movie_1', watched_on: '2026-10-01', rating10: 9, review: 'Obra maestra', spoiler: true, private_note: 'Con Bea' })
  })
})
