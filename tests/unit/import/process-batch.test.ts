// @vitest-environment node
// F-26 — Escritura de un lote: no se pisa nada, se completa; F-24 (rating10 y
// diario) con y sin bandera y con y sin migración; filas que caen en la misma
// ficha; fichas no disponibles → pending.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeDb, fakeClient, type FakeDb } from './helpers'
import type { ImportItem } from '@/lib/import/types'

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb, unavailable: new Set<string>() }))

vi.mock('@/lib/supabase/admin', async () => {
  const { fakeClient: fc } = await import('./helpers')
  return { createAdminClient: () => fc(state.db) }
})
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  ensureMediaRows: async (ids: string[]) => {
    const available = new Set(ids.filter((id) => !state.unavailable.has(id)))
    for (const id of available) state.db.tables.media.push({ id, title: `T ${id}`, year: 2000 })
    return { available, unresolved: ids.filter((id) => !available.has(id)) }
  },
}))

const anilist = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/http')>()),
  providerFetch: anilist.fetch,
}))

import { findLibraryByMal, mergeIncoming, planLibraryWrite, processImportBatch } from '@/lib/import/server/process-batch'

const item = (over: Partial<ImportItem>): ImportItem => ({
  key: '0',
  kind: 'movie',
  title: 'X',
  status: 'completed',
  rating10: null,
  watchedAt: null,
  ...over,
})

const run = (items: ImportItem[]) =>
  processImportBatch(items, { supabase: fakeClient(state.db) as never, userId: 'u1', locale: 'es' })

describe('planLibraryWrite (no pisar, completar)', () => {
  it('nueva → added', () => {
    expect(planLibraryWrite(undefined, { status: 'completed', rating10: 9, watchedAt: '2020-01-01' }).outcome).toBe('added')
  })
  it('la nota de KULTURA manda; la fecha y el estado solo avanzan', () => {
    const plan = planLibraryWrite(
      { status: 'pending', rating10: 6, watchedAt: null },
      { status: 'completed', rating10: 9, watchedAt: '2020-01-01' }
    )
    expect(plan).toEqual({ outcome: 'updated', entry: { status: 'completed', rating10: 6, watchedAt: '2020-01-01' } })
  })
  it('visto en KULTURA y "pendiente" en el archivo → se queda como está', () => {
    expect(planLibraryWrite({ status: 'completed', rating10: 8, watchedAt: '2019-01-01' }, { status: 'pending', rating10: null, watchedAt: null })).toEqual({
      outcome: 'kept',
      entry: null,
    })
  })
  it('varias filas a la misma ficha: la que más avanza, la primera nota, la fecha más reciente', () => {
    expect(
      mergeIncoming([
        item({ status: 'pending' }),
        item({ status: 'completed', rating10: 7, watchedAt: '2020-01-01' }),
        item({ status: 'in_progress', rating10: 9, watchedAt: '2021-01-01' }),
      ])
    ).toMatchObject({ status: 'completed', rating10: 7, watchedAt: '2021-01-01' })
  })
})

describe('processImportBatch', () => {
  beforeEach(() => {
    state.db = createFakeDb()
    state.unavailable = new Set()
  })
  afterEach(() => {
    delete process.env.RATING_SCALE_10
  })

  const logs = [
    { watchedOn: '2021-10-01', rewatch: false, rating10: 9, review: 'Muy buena', spoiler: false },
    { watchedOn: '2022-03-02', rewatch: true, rating10: 8.5, review: null, spoiler: false },
  ]

  it('sin RATING_SCALE_10: escribe score (redondeado) y no toca el diario', async () => {
    const r = await run([item({ ids: { tmdb: 1 }, rating10: 9, watchedAt: '2022-03-02', logs })])
    expect(r.results[0]).toMatchObject({ outcome: 'added', mediaId: 'movie_1', by: 'tmdb' })
    expect(state.db.tables.user_media[0]).toEqual({ user_id: 'u1', media_id: 'movie_1', status: 'completed', score: 5, watched_at: '2022-03-02' })
    expect(state.db.calls).not.toContain('user_media_logs.insert')
    expect(r.diaryImported).toBe(0)
  })

  it('con RATING_SCALE_10 y migración: rating10 sin pérdida y diario sin duplicar al reimportar', async () => {
    process.env.RATING_SCALE_10 = '1'
    const items = [item({ ids: { tmdb: 1 }, rating10: 9, watchedAt: '2022-03-02', logs })]
    const first = await run(items)
    expect(first.diaryImported).toBe(2)
    expect(state.db.tables.user_media[0]).toMatchObject({ rating10: 9, score: 5 })
    expect(state.db.tables.user_media_logs).toHaveLength(2)
    expect(state.db.tables.user_media_logs[0]).toMatchObject({ user_id: 'u1', media_id: 'movie_1', private_note: null })

    const again = await run(items)
    expect(again.results[0].outcome).toBe('kept')
    expect(again.diaryImported).toBe(0)
    expect(state.db.tables.user_media_logs).toHaveLength(2)
  })

  it('con la bandera pero SIN la migración (42703): se importa como antes, sin romper', async () => {
    process.env.RATING_SCALE_10 = '1'
    state.db.errors['user_media.noRating10'] = { code: '42703', message: 'column rating10 does not exist' }
    const r = await run([item({ ids: { tmdb: 1 }, rating10: 7.5, logs })])
    expect(r.results[0].outcome).toBe('added')
    expect(state.db.tables.user_media[0]).not.toHaveProperty('rating10')
    expect(state.db.tables.user_media[0].score).toBe(4)
    expect(state.db.calls).not.toContain('user_media_logs.insert')
  })

  it('lo que ya había no se pisa (nota de KULTURA) y lo que falta se completa', async () => {
    state.db.tables.user_media.push({ user_id: 'u1', media_id: 'movie_1', status: 'pending', score: 3, watched_at: null })
    state.db.tables.user_media.push({ user_id: 'u1', media_id: 'movie_2', status: 'completed', score: 4, watched_at: '2019-01-01' })
    const r = await run([
      item({ key: 'a', ids: { tmdb: 1 }, rating10: 10, watchedAt: '2020-05-05' }),
      item({ key: 'b', ids: { tmdb: 2 }, status: 'pending' }),
    ])
    expect(r.results.map((x) => x.outcome)).toEqual(['updated', 'kept'])
    expect(state.db.tables.user_media[0]).toMatchObject({ status: 'completed', score: 3, watched_at: '2020-05-05' })
    expect(state.db.tables.user_media[1]).toMatchObject({ status: 'completed', score: 4, watched_at: '2019-01-01' })
  })

  it('otra cuenta con el mismo título no se toca', async () => {
    state.db.tables.user_media.push({ user_id: 'otra', media_id: 'movie_1', status: 'pending', score: null, watched_at: null })
    await run([item({ ids: { tmdb: 1 }, rating10: 10 })])
    expect(state.db.tables.user_media.find((r) => r.user_id === 'otra')).toMatchObject({ status: 'pending', score: null })
    expect(state.db.tables.user_media.find((r) => r.user_id === 'u1')).toMatchObject({ score: 5 })
  })

  it('dos filas a la misma ficha: una sola entrada, mismo resultado para las dos', async () => {
    const r = await run([
      item({ key: 'a', ids: { tmdb: 1 }, status: 'pending' }),
      item({ key: 'b', ids: { tmdb: 1 }, rating10: 6 }),
    ])
    expect(state.db.tables.user_media).toHaveLength(1)
    expect(state.db.tables.user_media[0]).toMatchObject({ status: 'completed', score: 3 })
    expect(r.results.map((x) => x.outcome)).toEqual(['added', 'added'])
  })

  it('ficha que el proveedor no da ahora → pending (no se escribe una FK rota)', async () => {
    state.unavailable.add('movie_2')
    const r = await run([item({ key: 'a', ids: { tmdb: 1 } }), item({ key: 'b', ids: { tmdb: 2 } })])
    expect(r.results.map((x) => x.outcome)).toEqual(['added', 'pending'])
    expect(state.db.tables.user_media.map((x) => x.media_id)).toEqual(['movie_1'])
  })

  it('findLibraryByMal: id legacy de Jikan y ficha al- con metadata.malId, solo de SU biblioteca', async () => {
    state.db.tables.media.push(
      { id: 'manga_al-30002', type: 'manga', metadata: { malId: 2 } },
      { id: 'manga_al-9', type: 'manga', metadata: { malId: 9 } },
      { id: 'anime_al-77', type: 'anime', metadata: { malId: 2 } }
    )
    state.db.tables.user_media.push(
      { user_id: 'u1', media_id: 'manga_al-30002', status: 'completed' },
      { user_id: 'u1', media_id: 'manga_13', status: 'pending' },
      { user_id: 'otra', media_id: 'manga_al-9', status: 'pending' }
    )
    const db = fakeClient(state.db) as never
    const found = await findLibraryByMal(db, db, 'u1', 'manga', [2, 13, 9])
    expect(Array.from(found.entries()).sort()).toEqual([
      [13, 'manga_13'],
      [2, 'manga_al-30002'],
    ])
    state.db.errors['user_media.select'] = { code: '500', message: 'x' }
    await expect(findLibraryByMal(db, db, 'u1', 'manga', [2])).rejects.toThrow()
  })

  it('reimportar MAL con el título guardado como anime_{mal} no crea anime_al-N (sin duplicado)', async () => {
    anilist.fetch.mockResolvedValue({
      data: { Page: { media: [{ id: 5114, idMal: 5114, isAdult: false, title: { romaji: 'FMA:B', english: 'FMA:B', native: null }, coverImage: {}, genres: [], startDate: { year: 2009 } }] } },
    })
    state.db.tables.media.push({ id: 'anime_5114', type: 'anime', title: 'FMA:B', metadata: {} })
    state.db.tables.user_media.push({ user_id: 'u1', media_id: 'anime_5114', status: 'completed', score: 5, watched_at: null })
    const r = await run([item({ kind: 'anime', title: 'FMA:B', ids: { mal: 5114 }, rating10: 10 })])
    expect(r.results[0]).toMatchObject({ outcome: 'kept', mediaId: 'anime_5114', by: 'mal' })
    expect(state.db.tables.user_media.map((x) => x.media_id)).toEqual(['anime_5114'])
    expect(anilist.fetch).not.toHaveBeenCalled()
  })
})
