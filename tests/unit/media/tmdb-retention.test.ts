// ============================================================
// KULTURA — Saneamiento 12.8: datos de TMDB con menos de 6 meses
// src/app/api/cron/daily/tmdb-retention.ts (paso 5 del cron diario).
// ============================================================

import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ getMovie: vi.fn(), getTV: vi.fn() }))
vi.mock('@/lib/api/tmdb', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/tmdb')>()),
  getMovie: h.getMovie,
  getTV: h.getTV,
}))

import {
  BUDGET_MS,
  MAX_PER_RUN,
  TMDB_MAX_AGE_MS,
  buildRetentionUpdate,
  fetchFromTmdb,
  isTmdbRow,
  refreshTmdbData,
  type TmdbFetchResult,
  type TmdbRow,
} from '@/app/api/cron/daily/tmdb-retention'
import { ProviderError } from '@/lib/api/http'
import type { MediaItem } from '@/types/media'

const NOW = Date.parse('2026-11-16T06:00:00Z')
const row = (id: string, type: string, external_id: string): TmdbRow => ({
  id,
  type,
  external_id,
  metadata: { genres: ['Drama'], other: 1 },
})
const ITEM = {
  id: 'movie_550',
  externalId: '550',
  type: 'movie',
  title: 'El club de la lucha',
  poster: 'https://image.tmdb.org/t/p/w500/p.jpg',
  backdrop: undefined,
  year: 1999,
  synopsis: 'Nueva',
  genres: ['Drama', 'Thriller'],
} as unknown as MediaItem

/** Cliente admin falso: registra lo que se pide y devuelve lo preparado. */
function fakeAdmin(opts: { rows?: TmdbRow[]; selectError?: unknown; trCount?: number; trError?: unknown; updateError?: unknown } = {}) {
  const calls = { trFilters: [] as unknown[][], mediaFilters: [] as unknown[][], updates: [] as { id: unknown; patch: unknown }[] }
  const admin = {
    from: (table: string) => {
      if (table === 'media_translations') {
        const c = {
          delete: () => c,
          lt: (...a: unknown[]) => (calls.trFilters.push(['lt', ...a]), c),
          or: async (...a: unknown[]) => (calls.trFilters.push(['or', ...a]), { count: opts.trCount ?? 0, error: opts.trError ?? null }),
        }
        return c
      }
      let patch: unknown
      const c = {
        select: () => c,
        in: (...a: unknown[]) => (calls.mediaFilters.push(['in', ...a]), c),
        or: (...a: unknown[]) => (calls.mediaFilters.push(['or', ...a]), c),
        order: () => c,
        limit: async () => ({ data: opts.rows ?? [], error: opts.selectError ?? null }),
        update: (p: unknown) => ((patch = p), c),
        eq: async (_col: string, id: unknown) => (calls.updates.push({ id, patch }), { error: opts.updateError ?? null }),
      }
      return c
    },
  }
  return { admin: admin as never, calls }
}

describe('isTmdbRow', () => {
  it('películas, series y el anime de respaldo de TMDB; no AniList, Jikan ni otros tipos', () => {
    expect(isTmdbRow({ type: 'movie', external_id: '550' })).toBe(true)
    expect(isTmdbRow({ type: 'tv', external_id: '1399' })).toBe(true)
    expect(isTmdbRow({ type: 'anime', external_id: 'tmdb-37854' })).toBe(true)
    expect(isTmdbRow({ type: 'anime', external_id: 'al-21' })).toBe(false)
    expect(isTmdbRow({ type: 'anime', external_id: '21' })).toBe(false)
    expect(isTmdbRow({ type: 'game', external_id: '3498' })).toBe(false)
    expect(isTmdbRow({ type: 'movie', external_id: 'tt0137523' })).toBe(false)
  })
})

describe('fetchFromTmdb', () => {
  it('404 → gone; otro fallo → failed (no se vacía nada por un corte)', async () => {
    h.getMovie.mockRejectedValueOnce(new ProviderError('tmdb', 'http', 'x', { status: 404 }))
    expect(await fetchFromTmdb(row('movie_1', 'movie', '1'))).toEqual({ kind: 'gone' })
    h.getMovie.mockRejectedValueOnce(new ProviderError('tmdb', 'http', 'x', { status: 503 }))
    expect(await fetchFromTmdb(row('movie_1', 'movie', '1'))).toEqual({ kind: 'failed' })
    h.getTV.mockRejectedValueOnce(new Error('red'))
    expect(await fetchFromTmdb(row('anime_tmdb-5', 'anime', 'tmdb-5'))).toEqual({ kind: 'failed' })
    expect(h.getTV).toHaveBeenLastCalledWith(5, expect.anything())
  })
})

describe('buildRetentionUpdate', () => {
  const iso = new Date(NOW).toISOString()

  it('con datos nuevos los escribe tal cual (sin mezclar con los viejos) y no toca el título', () => {
    const patch = buildRetentionUpdate(row('movie_550', 'movie', '550'), { kind: 'ok', item: ITEM }, iso)
    expect(patch).toEqual({
      poster: ITEM.poster,
      backdrop: null,
      year: 1999,
      synopsis: 'Nueva',
      metadata: { genres: ['Drama', 'Thriller'], other: 1, genresSyncedAt: iso },
      updated_at: iso,
    })
    expect(patch).not.toHaveProperty('title')
  })

  it('si TMDB ya no la tiene, vacía sus datos y deja la fila', () => {
    expect(buildRetentionUpdate(row('movie_9', 'movie', '9'), { kind: 'gone' }, iso)).toEqual({
      poster: null,
      backdrop: null,
      year: null,
      synopsis: null,
      metadata: { genres: [], other: 1, genresSyncedAt: iso, tmdbGone: true },
      updated_at: iso,
    })
  })
})

describe('refreshTmdbData', () => {
  it('borra traducciones viejas de TMDB y refresca o vacía las fichas de más de 6 meses', async () => {
    const rows = [row('movie_1', 'movie', '1'), row('anime_al-2', 'anime', 'al-2'), row('tv_3', 'tv', '3'), row('movie_4', 'movie', '4')]
    const { admin, calls } = fakeAdmin({ rows, trCount: 3 })
    const answers: Record<string, TmdbFetchResult> = {
      movie_1: { kind: 'ok', item: ITEM },
      tv_3: { kind: 'gone' },
      movie_4: { kind: 'failed' },
    }
    const fetchItem = vi.fn(async (r: TmdbRow) => answers[r.id])

    const res = await refreshTmdbData({ admin, fetchItem, now: () => NOW })

    expect(res).toEqual({ status: 'done', refreshed: 1, emptied: 1, failed: 1, translationsDeleted: 3 })
    const cutoff = new Date(NOW - TMDB_MAX_AGE_MS).toISOString()
    expect(calls.trFilters).toEqual([
      ['lt', 'created_at', cutoff],
      ['or', 'media_id.like.movie_%,media_id.like.tv_%,media_id.like.anime_tmdb-%'],
    ])
    expect(calls.mediaFilters).toContainEqual(['or', `updated_at.lt.${cutoff},updated_at.is.null`])
    // El anime de AniList no se pide a TMDB; el que falló no se toca.
    expect(fetchItem.mock.calls.map(([r]) => r.id)).toEqual(['movie_1', 'tv_3', 'movie_4'])
    expect(calls.updates.map((u) => u.id)).toEqual(['movie_1', 'tv_3'])
  })

  it(`como mucho ${MAX_PER_RUN} por ejecución y para al pasar de ${BUDGET_MS / 1000} s`, async () => {
    const many = Array.from({ length: MAX_PER_RUN + 5 }, (_, i) => row(`movie_${i}`, 'movie', String(i)))
    const fetchItem = vi.fn(async (): Promise<TmdbFetchResult> => ({ kind: 'ok', item: ITEM }))
    expect((await refreshTmdbData({ admin: fakeAdmin({ rows: many }).admin, fetchItem, now: () => NOW })).refreshed).toBe(MAX_PER_RUN)

    let t = NOW
    const slow = vi.fn(async (): Promise<TmdbFetchResult> => ((t += BUDGET_MS / 2 + 1), { kind: 'ok', item: ITEM }))
    const res = await refreshTmdbData({ admin: fakeAdmin({ rows: many }).admin, fetchItem: slow, now: () => t })
    expect(res.refreshed).toBe(2)
  })

  it('si la base falla, status error (el cron lo cuenta) y no pide nada a TMDB', async () => {
    const fetchItem = vi.fn()
    const res = await refreshTmdbData({ admin: fakeAdmin({ selectError: { code: '500' } }).admin, fetchItem, now: () => NOW })
    expect(res.status).toBe('error')
    expect(fetchItem).not.toHaveBeenCalled()
  })
})
