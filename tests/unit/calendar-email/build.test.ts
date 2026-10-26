// ============================================================
// F-28 — Calendario: presupuesto de peticiones, fallos parciales, orden y
// lectura de la biblioteca (caché por persona).
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { buildCalendar, CALENDAR_REQUEST_BUDGET, type CalendarFetchers } from '@/lib/calendar/build'
import { getUserCalendar, toCandidates } from '@/lib/calendar/data'
import { fakeSupabase, opsOf } from '../plataformas-listas/fake-supabase'
import {
  NOW,
  WINDOW,
  anilistBatch,
  candidate,
  mangadexFeed,
  rawgGameDay,
  tmdbMovieUpcoming,
  tmdbTvEnded,
  tmdbTvReturning,
  tmdbTvSeasonPremiere,
} from './fixtures'
import { indexAniList } from '@/lib/calendar/sources'

function fetchers(over: Partial<CalendarFetchers> = {}): CalendarFetchers & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    tmdbTv: vi.fn(async (id: number) => {
      calls.push(`tv:${id}`)
      if (id === 66732) return tmdbTvSeasonPremiere
      if (id === 1396) return tmdbTvEnded
      return { ...tmdbTvReturning, id }
    }),
    tmdbMovie: vi.fn(async (id: number) => {
      calls.push(`movie:${id}`)
      return { ...tmdbMovieUpcoming, id }
    }),
    rawg: vi.fn(async (id: number) => {
      calls.push(`game:${id}`)
      return { ...rawgGameDay, id }
    }),
    mangadex: vi.fn(async (id: string) => {
      calls.push(`mangadex:${id}`)
      return mangadexFeed
    }),
    anilist: vi.fn(async (plans) => {
      calls.push(`anilist:${plans.length}`)
      return indexAniList(anilistBatch)
    }),
    ...over,
  }
}

describe('buildCalendar', () => {
  it('aceptación: con 3 series en curso se ven sus fechas, en orden', async () => {
    const f = fetchers()
    const result = await buildCalendar(
      [candidate('tv_100088', 'in_progress', 'The Last of Us'), candidate('tv_66732', 'in_progress', 'Stranger Things'), candidate('tv_1396', 'in_progress', 'Breaking Bad')],
      WINDOW,
      { fetchers: f }
    )
    expect(result.events.map((e) => [e.title, e.date, e.kind])).toEqual([
      ['The Last of Us', '2026-12-07', 'episode'],
      ['The Last of Us', '2026-12-14', 'episode'],
      ['Stranger Things', '2026-12-18', 'season_premiere'],
    ])
    expect(result).toMatchObject({ candidates: 3, checked: 3, failed: 0, today: '2026-12-14' })
  })

  it('mezcla de formatos; AniList en UNA petición para todos sus títulos', async () => {
    const f = fetchers()
    const result = await buildCalendar(
      [
        candidate('anime_al-21'),
        candidate('anime_52991', 'pending'),
        candidate('movie_1084242', 'pending'),
        candidate('game_58550', 'pending'),
        candidate('manga_a1b2c3d4-0000-4000-8000-000000000000'),
        candidate('book_OL1W', 'pending'),
      ],
      WINDOW,
      { fetchers: f }
    )
    expect(f.calls.filter((c) => c.startsWith('anilist'))).toEqual(['anilist:2'])
    expect(result.candidates).toBe(5) // el libro no tiene de dónde sacar fechas
    expect(result.events.map((e) => e.date)).toEqual([...result.events.map((e) => e.date)].sort())
    expect(new Set(result.events.map((e) => e.type))).toEqual(new Set(['anime', 'movie', 'game', 'manga']))
  })

  it('presupuesto: nunca más peticiones de las permitidas; primero lo más reciente', async () => {
    const many = Array.from({ length: 70 }, (_, i) => candidate(`tv_${1000 + i}`))
    const f = fetchers()
    const result = await buildCalendar(many, WINDOW, { fetchers: f })
    expect(f.calls).toHaveLength(CALENDAR_REQUEST_BUDGET)
    expect(f.calls[0]).toBe('tv:1000')
    expect(result).toMatchObject({ candidates: 70, checked: CALENDAR_REQUEST_BUDGET })
  })

  it('como mucho 4 peticiones a la vez', async () => {
    let active = 0
    let peak = 0
    const f = fetchers({
      tmdbTv: async (id) => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 5))
        active--
        return { ...tmdbTvReturning, id }
      },
    })
    await buildCalendar(Array.from({ length: 12 }, (_, i) => candidate(`tv_${i + 1}`)), WINDOW, { fetchers: f })
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('un proveedor caído deja fuera solo sus títulos', async () => {
    const f = fetchers({
      rawg: async () => {
        throw new Error('RAWG 503')
      },
    })
    const result = await buildCalendar([candidate('tv_100088'), candidate('game_1', 'pending')], WINDOW, { fetchers: f })
    expect(result.failed).toBe(1)
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.events.every((e) => e.type === 'tv')).toBe(true)
  })

  it('el mismo título dos veces cuenta una', async () => {
    const f = fetchers()
    const result = await buildCalendar([candidate('tv_100088'), candidate('tv_100088')], WINDOW, { fetchers: f })
    expect(f.calls).toEqual(['tv:100088'])
    expect(result.candidates).toBe(1)
  })
})

describe('lectura de la biblioteca', () => {
  it('toCandidates: primero «en curso», después pendientes; ids raros fuera', () => {
    const rows = [
      { media_id: 'movie_1', status: 'pending', updated_at: '3', media: { title: 'Peli', poster: null } },
      { media_id: 'tv_2', status: 'in_progress', updated_at: '2', media: [{ title: 'Serie', poster: 'https://image.tmdb.org/p.jpg' }] },
      { media_id: 'raro', status: 'pending', updated_at: '1', media: null },
      { media_id: 'podcast_1', status: 'pending', updated_at: '1', media: null },
      { media_id: 'tv_3', status: 'completed', updated_at: '1', media: null },
    ]
    expect(toCandidates(rows)).toEqual([
      { mediaId: 'tv_2', type: 'tv', externalId: '2', title: 'Serie', poster: 'https://image.tmdb.org/p.jpg', status: 'in_progress' },
      { mediaId: 'movie_1', type: 'movie', externalId: '1', title: 'Peli', poster: null, status: 'pending' },
    ])
  })

  it('getUserCalendar: solo SUS filas en curso o pendientes; región de «Mis plataformas»', async () => {
    const client = fakeSupabase({
      tables: {
        user_media: [{ data: [{ media_id: 'movie_1084242', status: 'pending', updated_at: 'x', media: { title: 'V', poster: null } }], error: null }],
        user_streaming_services: [{ data: { services: [], region: 'US' }, error: null }],
      },
    })
    const f = fetchers()
    const result = await getUserCalendar(client as never, 'u1', 'es', { now: NOW, fetchers: f })
    expect(opsOf(client, 'user_media', 'eq')).toContainEqual({ name: 'eq', args: ['user_id', 'u1'] })
    expect(opsOf(client, 'user_media', 'in')).toContainEqual({ name: 'in', args: ['status', ['in_progress', 'pending']] })
    // US: cines el 18 y digital el 2 de febrero.
    expect(result.events.map((e) => e.kind)).toEqual(['theatrical', 'digital'])
  })

  it('sin la tabla de plataformas (antes de F-25): la región del idioma', async () => {
    const client = fakeSupabase({
      tables: {
        user_media: [{ data: [{ media_id: 'movie_1084242', status: 'pending', updated_at: 'x', media: null }], error: null }],
        user_streaming_services: [{ data: null, error: { code: 'PGRST205' } }],
      },
    })
    const result = await getUserCalendar(client as never, 'u1', 'es', { now: NOW, fetchers: fetchers() })
    expect(result.events.map((e) => [e.kind, e.region])).toEqual([['theatrical', 'ES']])
  })

  it('biblioteca vacía: ni una petición a proveedores', async () => {
    const client = fakeSupabase({ tables: { user_media: [{ data: [], error: null }] } })
    const f = fetchers()
    const result = await getUserCalendar(client as never, 'u1', 'es', { now: NOW, fetchers: f })
    expect(result).toEqual({ events: [], candidates: 0, checked: 0, failed: 0, today: '2026-12-14' })
    expect(f.calls).toEqual([])
  })

  it('si la biblioteca no se puede leer, lanza (la página lo enseña como error)', async () => {
    const client = fakeSupabase({ tables: { user_media: [{ data: null, error: { code: '500', message: 'x' } }] } })
    await expect(getUserCalendar(client as never, 'u1', 'es', { now: NOW, fetchers: fetchers() })).rejects.toThrow()
  })
})
