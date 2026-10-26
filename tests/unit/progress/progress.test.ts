// ============================================================
// F-27 · Progreso por formato: lectura (columnas o jsonb de siempre),
// validación, «marcar siguiente» con el plan de TMDB/AniList/RAWG y la
// proporción para la barra.
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  compactProgress,
  isAtEnd,
  nextProgress,
  parseProgressInput,
  progressFromJson,
  progressFromRow,
  progressKindFor,
  progressPercent,
  progressToColumns,
  progressToLegacy,
  quickUnit,
  rowHasProgressColumns,
  totalFor,
} from '@/lib/library/progress'
import { planFromMetadata, tvPlanFromTmdb } from '@/lib/library/progress-server'
import { normalizeAniListAnime, normalizeGame } from '@/lib/api/normalizer'
import type { AniListMedia } from '@/lib/api/anilist'
import type { RawgGame } from '@/lib/api/rawg'
import { ANILIST_BEBOP, RAWG_HADES, TV_GOT, TV_TLOU } from './fixtures/tmdb'

const GOT = tvPlanFromTmdb(TV_GOT)
const TLOU = tvPlanFromTmdb(TV_TLOU)

describe('formatos', () => {
  it('cada tipo cuenta lo suyo; las películas no tienen progreso', () => {
    expect(progressKindFor('tv')).toBe('tv')
    expect(progressKindFor('anime')).toBe('anime')
    expect(progressKindFor('manga')).toBe('reading')
    expect(progressKindFor('comic')).toBe('reading')
    expect(progressKindFor('book')).toBe('book')
    expect(progressKindFor('game')).toBe('game')
    expect(progressKindFor('movie')).toBeNull()
  })
})

describe('lectura: antes y después de la migración', () => {
  it('el jsonb de siempre ({season, episode}) se lee igual', () => {
    expect(progressFromJson({ season: 2, episode: 5 })).toEqual({ season: 2, episode: 5 })
    expect(progressFromJson({ episode: 12 })).toEqual({ episode: 12 })
  })

  it('un jsonb raro no rompe nada: lo que no es número o se sale del rango se descarta', () => {
    expect(progressFromJson({ season: 'x', episode: 'abc' })).toBeNull()
    expect(progressFromJson({ episode: 0 })).toBeNull()
    expect(progressFromJson({ percent: 250, page: 30 })).toEqual({ page: 30 })
    expect(progressFromJson([1, 2])).toBeNull()
    expect(progressFromJson(null)).toBeNull()
    // Solo el total no es progreso.
    expect(progressFromJson({ total: 10 })).toBeNull()
  })

  it('sin las columnas (antes) se lee el jsonb; con ellas (después) mandan las columnas', () => {
    const before = { status: 'in_progress', episode_progress: { season: 1, episode: 3 } }
    expect(rowHasProgressColumns(before)).toBe(false)
    expect(progressFromRow(before)).toEqual({ season: 1, episode: 3 })

    const after = {
      ...before,
      ...progressToColumns(null),
      progress_page: 120,
      progress_total: 350,
      episode_progress: { page: 120, total: 350 },
    }
    expect(rowHasProgressColumns(after)).toBe(true)
    expect(progressFromRow(after)).toEqual({ page: 120, total: 350 })
  })

  it('PostgREST devuelve numeric como número o cadena: las dos valen', () => {
    const row = { ...progressToColumns(null), progress_hours: '12.5', progress_chapter: 10.5 }
    expect(progressFromRow(row)).toEqual({ hours: 12.5, chapter: 10.5 })
  })

  it('columnas: todas presentes (las que no van, a NULL) y forma antigua solo con episodio', () => {
    expect(progressToColumns({ page: 10 })).toEqual({
      progress_season: null,
      progress_episode: null,
      progress_chapter: null,
      progress_volume: null,
      progress_page: 10,
      progress_percent: null,
      progress_hours: null,
      progress_total: null,
    })
    expect(progressToLegacy({ season: 2, episode: 4, total: 10 })).toEqual({ season: 2, episode: 4 })
    expect(progressToLegacy({ episode: 4 })).toEqual({ episode: 4 })
    expect(progressToLegacy({ page: 10 })).toBeNull()
    expect(compactProgress({ page: null, percent: 30, total: null })).toEqual({ percent: 30 })
  })
})

describe('validación de lo que manda el cliente', () => {
  it('acepta los campos de su formato dentro de rango', () => {
    expect(parseProgressInput('tv', { season: 1, episode: 4 })).toEqual({ ok: true, value: { season: 1, episode: 4 } })
    expect(parseProgressInput('manga', { chapter: 10.5, volume: 2 })).toEqual({ ok: true, value: { chapter: 10.5, volume: 2 } })
    expect(parseProgressInput('game', { hours: 12.25 })).toEqual({ ok: true, value: { hours: 12.3 } })
    expect(parseProgressInput('book', { page: 30, total: 300 })).toEqual({ ok: true, value: { page: 30, total: 300 } })
    expect(parseProgressInput('book', null)).toEqual({ ok: true, value: null })
  })

  it('rechaza campos de otro formato, fuera de rango o no enteros', () => {
    expect(parseProgressInput('tv', { page: 3 }).ok).toBe(false)
    expect(parseProgressInput('book', { percent: 101 }).ok).toBe(false)
    expect(parseProgressInput('tv', { episode: 1.5 }).ok).toBe(false)
    expect(parseProgressInput('movie', { episode: 1 }).ok).toBe(false)
    expect(parseProgressInput('tv', 'S1E2').ok).toBe(false)
  })

  it('libro: páginas o porcentaje, no las dos', () => {
    expect(parseProgressInput('book', { page: 30, percent: 10 })).toEqual({ ok: true, value: { page: 30 } })
  })
})

describe('plan de TMDB (series)', () => {
  it('sin especiales, en orden, con el estado de la serie', () => {
    expect(GOT.seasons).toHaveLength(8)
    expect(GOT.seasons?.[0]).toEqual({ number: 1, episodes: 10 })
    expect(GOT.ended).toBe(true)
    expect(GOT.lastAired).toBeNull()
    expect(TLOU.ended).toBe(false)
    expect(TLOU.lastAired).toEqual({ season: 2, episode: 7 })
  })

  it('el total de una serie es el de la temporada en la que vas', () => {
    expect(totalFor('tv', { season: 7, episode: 1 }, GOT)).toBe(7)
    expect(totalFor('tv', { season: 8, episode: 1 }, GOT)).toBe(6)
  })
})

describe('marcar siguiente', () => {
  it('series: siguiente episodio, y al acabar la temporada, el primero de la siguiente', () => {
    expect(nextProgress('tv', { season: 1, episode: 3 }, GOT)).toMatchObject({
      value: { season: 1, episode: 4, total: 10 },
      finished: false,
    })
    expect(nextProgress('tv', { season: 1, episode: 10 }, GOT)?.value).toEqual({ season: 2, episode: 1, total: 10 })
    expect(nextProgress('tv', { season: 6, episode: 10 }, GOT)?.value).toEqual({ season: 7, episode: 1, total: 7 })
  })

  it('series: sin progreso empieza por T1·E1', () => {
    expect(nextProgress('tv', null, GOT)?.value).toEqual({ season: 1, episode: 1, total: 10 })
  })

  it('series terminadas: marcar el último episodio propone pasar a «Completado»', () => {
    const last = nextProgress('tv', { season: 8, episode: 5 }, GOT)
    expect(last).toMatchObject({ value: { season: 8, episode: 6 }, finished: true, caughtUp: false })
    // Ya en el último: no hay más que marcar, se vuelve a proponer.
    const again = nextProgress('tv', { season: 8, episode: 6 }, GOT)
    expect(again).toMatchObject({ value: { season: 8, episode: 6 }, finished: true })
  })

  it('series en emisión: no se marca más allá del último emitido (al día) y no se da por terminada', () => {
    const atLast = nextProgress('tv', { season: 2, episode: 6 }, TLOU)
    expect(atLast).toMatchObject({ value: { season: 2, episode: 7 }, finished: false, caughtUp: false })
    const beyond = nextProgress('tv', { season: 2, episode: 7 }, TLOU)
    expect(beyond).toMatchObject({ value: { season: 2, episode: 7 }, finished: false, caughtUp: true })
  })

  it('series sin estado de TMDB: el último episodio no se da por terminado (solo con ended)', () => {
    const plan = { seasons: [{ number: 1, episodes: 8 }] }
    expect(isAtEnd('tv', { season: 1, episode: 8 }, plan)).toBe(false)
    expect(nextProgress('tv', { season: 1, episode: 7 }, plan)).toMatchObject({ value: { episode: 8 }, finished: false })
    expect(nextProgress('tv', { season: 1, episode: 8 }, plan)).toMatchObject({ finished: false, caughtUp: true })
    expect(isAtEnd('tv', { season: 1, episode: 8 }, { ...plan, ended: true })).toBe(true)
  })

  it('series sin plan (TMDB caído): +1 episodio, sin cambiar de temporada ni proponer nada', () => {
    expect(nextProgress('tv', { season: 1, episode: 10 }, null)).toMatchObject({
      value: { season: 1, episode: 11 },
      finished: false,
    })
  })

  it('anime con el total de AniList: +1 y al llegar al 26 se propone completar', () => {
    const plan = planFromMetadata('anime', normalizeAniListAnime(ANILIST_BEBOP as unknown as AniListMedia).metadata)
    expect(plan).toEqual({ total: 26, ended: true })
    expect(nextProgress('anime', { episode: 12 }, plan)).toMatchObject({ value: { episode: 13, total: 26 }, finished: false })
    expect(nextProgress('anime', { episode: 25 }, plan)).toMatchObject({ value: { episode: 26 }, finished: true })
    expect(nextProgress('anime', { episode: 26 }, plan)).toMatchObject({ value: { episode: 26 }, finished: true })
  })

  it('manga y cómic: +1 capítulo (de 10.5 al 11), el volumen se queda', () => {
    expect(nextProgress('manga', { chapter: 10.5, volume: 2 }, { total: 100 })?.value).toEqual({
      chapter: 11,
      volume: 2,
      total: 100,
    })
    expect(nextProgress('comic', null, null)?.value).toEqual({ chapter: 1 })
    expect(nextProgress('manga', { chapter: 99 }, { total: 100 })?.finished).toBe(true)
  })

  it('libros: +10 páginas (sin pasar del total) o +5 %; al final se propone completar', () => {
    expect(nextProgress('book', { page: 120 }, { total: 350 })?.value).toEqual({ page: 130, total: 350 })
    expect(nextProgress('book', { page: 345 }, { total: 350 })).toMatchObject({ value: { page: 350 }, finished: true })
    expect(nextProgress('book', { percent: 40 }, null)?.value).toEqual({ percent: 45 })
    expect(nextProgress('book', { percent: 98 }, null)).toMatchObject({ value: { percent: 100 }, finished: true })
    // Sin progreso ni total, en porcentaje; con total, en páginas.
    expect(nextProgress('book', null, null)?.value).toEqual({ percent: 5 })
    expect(nextProgress('book', null, { total: 200 })?.value).toEqual({ page: 10, total: 200 })
    // Nunca hacia atrás: ibas por encima del total de la ficha (otra edición).
    expect(nextProgress('book', { page: 400 }, { total: 350 })?.value).toEqual({ page: 400, total: 350 })
  })

  it('juegos: +1 hora frente a la media de RAWG, y las horas nunca dan un juego por terminado', () => {
    const plan = planFromMetadata('game', normalizeGame(RAWG_HADES as unknown as RawgGame).metadata)
    expect(plan).toEqual({ total: 22 })
    expect(nextProgress('game', { hours: 12.5 }, plan)?.value).toEqual({ hours: 13.5, total: 22 })
    expect(nextProgress('game', { hours: 40 }, plan)?.finished).toBe(false)
  })

  it('películas: nada que marcar', () => {
    expect(nextProgress('movie', null, null)).toBeNull()
  })
})

describe('barra y unidad del botón', () => {
  it('porcentaje con el total; libro en % tal cual; sin total, nada', () => {
    expect(progressPercent('book', { page: 120, total: 350 })).toBe(34)
    expect(progressPercent('book', { percent: 45 })).toBe(45)
    // Hacia abajo: casi terminado no es 100 %; y sin errores de coma flotante.
    expect(progressPercent('book', { page: 349, total: 350 })).toBe(99)
    expect(progressPercent('book', { page: 29, total: 100 })).toBe(29)
    expect(progressPercent('book', { page: 350, total: 350 })).toBe(100)
    expect(progressPercent('tv', { season: 2, episode: 5, total: 10 })).toBe(50)
    expect(progressPercent('game', { hours: 30, total: 22 })).toBe(100)
    expect(progressPercent('tv', { episode: 5 })).toBeNull()
    expect(progressPercent('movie', { episode: 5, total: 10 })).toBeNull()
  })

  it('isAtEnd solo con datos', () => {
    expect(isAtEnd('book', { page: 10 }, null)).toBe(false)
    expect(isAtEnd('tv', { season: 8, episode: 6 }, GOT)).toBe(true)
    expect(isAtEnd('tv', { season: 2, episode: 7 }, TLOU)).toBe(false)
  })

  it('unidad del toque', () => {
    expect(quickUnit('tv', null)).toBe('episode')
    expect(quickUnit('comic', null)).toBe('chapter')
    expect(quickUnit('book', { page: 3 })).toBe('page')
    expect(quickUnit('book', null)).toBe('advance')
    expect(quickUnit('book', { total: 350 })).toBe('advance')
    expect(quickUnit('book', { percent: 10 })).toBe('percent')
    expect(quickUnit('game', null)).toBe('hours')
    expect(quickUnit('movie', null)).toBeNull()
  })
})
