// ============================================================
// KULTURA — Calendario (F-28, PRO-12): de la biblioteca a los eventos
//
// Presupuesto por calendario: como mucho `CALENDAR_REQUEST_BUDGET` peticiones
// a proveedores (AniList va en una sola por cada 50 títulos) y
// `CALENDAR_CONCURRENCY` a la vez. Se consultan primero los títulos "en
// curso" y después los pendientes, del más reciente al más antiguo; lo que no
// cabe se cuenta (`candidates − checked`) y la página lo dice. Un proveedor
// que falla deja fuera solo sus títulos (`failed`), nunca el calendario.
// ============================================================

import { createLogger } from '@/lib/logger'
import {
  anilistKey,
  fetchAniListBatch,
  fetchMangaDexFeed,
  fetchRawgGame,
  fetchTmdbMovie,
  fetchTmdbTv,
  parseAniList,
  parseMangaDexFeed,
  parseRawgGame,
  parseTmdbMovie,
  parseTmdbTv,
  planFor,
  ANILIST_BATCH,
  type AniListCalendarMedia,
  type CalendarWindow,
  type MangaDexFeed,
  type RawgGameCalendar,
  type SourcePlan,
  type TmdbMovieCalendar,
  type TmdbTvCalendar,
} from './sources'
import { compareEvents, type CalendarCandidate, type CalendarEvent, type CalendarResult } from './types'

const log = createLogger('calendar')

/** Peticiones a proveedores como máximo por calendario (una persona, una carga). */
export const CALENDAR_REQUEST_BUDGET = 40
/** Peticiones simultáneas como máximo. */
export const CALENDAR_CONCURRENCY = 4

export interface CalendarFetchers {
  tmdbTv: (id: number, locale: string) => Promise<TmdbTvCalendar>
  tmdbMovie: (id: number) => Promise<TmdbMovieCalendar>
  rawg: (id: number) => Promise<RawgGameCalendar>
  mangadex: (id: string, locale: string) => Promise<MangaDexFeed>
  anilist: (plans: Array<Extract<SourcePlan, { source: 'anilist' }>>) => Promise<Map<string, AniListCalendarMedia>>
}

export const defaultFetchers: CalendarFetchers = {
  tmdbTv: fetchTmdbTv,
  tmdbMovie: fetchTmdbMovie,
  rawg: fetchRawgGame,
  mangadex: fetchMangaDexFeed,
  anilist: fetchAniListBatch,
}

async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await work(item)
    }
  })
  await Promise.all(runners)
}

export async function buildCalendar(
  candidates: CalendarCandidate[],
  w: CalendarWindow,
  opts: { budget?: number; fetchers?: CalendarFetchers } = {}
): Promise<CalendarResult> {
  const fetchers = opts.fetchers ?? defaultFetchers
  let budget = Math.max(0, opts.budget ?? CALENDAR_REQUEST_BUDGET)

  // Uno por título y solo los que tienen de dónde sacar fechas.
  const seen = new Set<string>()
  const planned: Array<{ c: CalendarCandidate; plan: SourcePlan }> = []
  for (const c of candidates) {
    if (seen.has(c.mediaId)) continue
    seen.add(c.mediaId)
    const plan = planFor(c)
    if (plan) planned.push({ c, plan })
  }

  // AniList primero: un lote de hasta 50 por petición.
  const anilistItems = planned.filter((p): p is { c: CalendarCandidate; plan: Extract<SourcePlan, { source: 'anilist' }> } => p.plan.source === 'anilist')
  const others = planned.filter((p) => p.plan.source !== 'anilist')
  const anilistTaken: typeof anilistItems = []
  for (let i = 0; i < anilistItems.length && budget > 0; i += ANILIST_BATCH) {
    anilistTaken.push(...anilistItems.slice(i, i + ANILIST_BATCH))
    budget--
  }
  const othersTaken = others.slice(0, budget)

  const events: CalendarEvent[] = []
  let failed = 0

  const anilistWork = (async () => {
    for (let i = 0; i < anilistTaken.length; i += ANILIST_BATCH) {
      const chunk = anilistTaken.slice(i, i + ANILIST_BATCH)
      try {
        const found = await fetchers.anilist(chunk.map((x) => x.plan))
        for (const { c, plan } of chunk) {
          const media = found.get(anilistKey(plan))
          if (media) events.push(...parseAniList(c, media, w))
        }
      } catch (err) {
        failed += chunk.length
        log.warn('calendario: AniList no respondió', { count: chunk.length, err })
      }
    }
  })()

  const otherWork = pool(othersTaken, CALENDAR_CONCURRENCY, async ({ c, plan }) => {
    try {
      switch (plan.source) {
        case 'tmdb_tv':
          events.push(...parseTmdbTv(c, await fetchers.tmdbTv(plan.id, w.locale), w))
          break
        case 'tmdb_movie':
          events.push(...parseTmdbMovie(c, await fetchers.tmdbMovie(plan.id), w))
          break
        case 'rawg':
          events.push(...parseRawgGame(c, await fetchers.rawg(plan.id), w))
          break
        case 'mangadex':
          events.push(...parseMangaDexFeed(c, await fetchers.mangadex(plan.id, w.locale), w))
          break
      }
    } catch (err) {
      failed++
      log.warn('calendario: un proveedor no respondió', { source: plan.source, err })
    }
  })

  await Promise.all([anilistWork, otherWork])

  const unique = new Map<string, CalendarEvent>()
  for (const e of events) unique.set(e.id, e)
  return {
    events: [...unique.values()].sort(compareEvents),
    candidates: planned.length,
    checked: anilistTaken.length + othersTaken.length,
    failed,
    today: w.today,
  }
}
