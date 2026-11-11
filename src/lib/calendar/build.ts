// ============================================================
// KULTURA — Calendario (F-28, PRO-12): de la biblioteca a los eventos
//
// Presupuesto por calendario: como mucho `CALENDAR_REQUEST_BUDGET` peticiones
// a proveedores (AniList va en una sola por cada 50 títulos) y
// `CALENDAR_CONCURRENCY` a la vez. Se consultan primero los títulos "en
// curso" y después los pendientes, del más reciente al más antiguo; lo que no
// cabe se cuenta (`candidates − checked`) y la página lo dice. Un proveedor
// que falla deja fuera solo sus títulos (`failed`), nunca el calendario.
//
// Saneamiento 5.1: el calendario tardaba 6,6 s porque un proveedor lento
// agotaba el plazo general (6 s). Ahora cada petición tiene un plazo propio
// (sources.ts) y el calendario entero un tope (`CALENDAR_DEADLINE_MS`): lo que
// no ha respondido para entonces cuenta como fallo y se reintenta en la
// siguiente visita (los títulos ya resueltos salen de la caché de 6 h).
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
export const CALENDAR_CONCURRENCY = 6
/** Tope del calendario entero: pasado este tiempo se pinta con lo que haya. */
export const CALENDAR_DEADLINE_MS = 3500

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

async function pool<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
  stopped: () => boolean
): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !stopped()) {
      const item = items[next++]
      await work(item)
    }
  })
  await Promise.all(runners)
}

export async function buildCalendar(
  candidates: CalendarCandidate[],
  w: CalendarWindow,
  opts: { budget?: number; fetchers?: CalendarFetchers; deadlineMs?: number } = {}
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
  // Títulos cuya respuesta aún no ha llegado (se resuelven o fallan).
  let pending = anilistTaken.length + othersTaken.length
  let timedOut = false
  const stopped = () => timedOut
  // Tras el tope, lo que llegue tarde se descarta (el resultado ya se devolvió).
  const accept = (list: CalendarEvent[]) => {
    if (!timedOut) events.push(...list)
  }

  const anilistWork = (async () => {
    for (let i = 0; i < anilistTaken.length; i += ANILIST_BATCH) {
      const chunk = anilistTaken.slice(i, i + ANILIST_BATCH)
      try {
        if (timedOut) return
        const found = await fetchers.anilist(chunk.map((x) => x.plan))
        if (timedOut) return
        for (const { c, plan } of chunk) {
          const media = found.get(anilistKey(plan))
          if (media) accept(parseAniList(c, media, w))
        }
        pending -= chunk.length
      } catch (err) {
        if (timedOut) return
        failed += chunk.length
        pending -= chunk.length
        log.warn('calendario: AniList no respondió', { count: chunk.length, err })
      }
    }
  })()

  const otherWork = pool(othersTaken, CALENDAR_CONCURRENCY, async ({ c, plan }) => {
    try {
      switch (plan.source) {
        case 'tmdb_tv':
          accept(parseTmdbTv(c, await fetchers.tmdbTv(plan.id, w.locale), w))
          break
        case 'tmdb_movie':
          accept(parseTmdbMovie(c, await fetchers.tmdbMovie(plan.id), w))
          break
        case 'rawg':
          accept(parseRawgGame(c, await fetchers.rawg(plan.id), w))
          break
        case 'mangadex':
          accept(parseMangaDexFeed(c, await fetchers.mangadex(plan.id, w.locale), w))
          break
      }
      if (!timedOut) pending--
    } catch (err) {
      if (timedOut) return
      failed++
      pending--
      log.warn('calendario: un proveedor no respondió', { source: plan.source, err })
    }
  }, stopped)

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true
      resolve()
    }, opts.deadlineMs ?? CALENDAR_DEADLINE_MS)
  })
  await Promise.race([Promise.all([anilistWork, otherWork]), deadline])
  clearTimeout(timer)
  if (timedOut && pending > 0) {
    // Sin respuesta a tiempo (en curso o sin empezar): cuentan como fallo.
    failed += pending
    log.warn('calendario: tope alcanzado', { pending })
  }

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
