// ============================================================
// KULTURA — Calendario (F-28, PRO-12): tipos y fechas
// Sin servidor ni red: lo usan la página, el correo semanal y los tests.
// ============================================================

import type { MediaType } from '@/types/media'

/**
 * Qué pasa ese día:
 * - `episode`: episodio de una serie o un anime que sigues.
 * - `season_premiere`: primer episodio de una temporada nueva (T2E1…).
 * - `series_premiere`: estreno de una serie, anime o manga que tienes pendiente.
 * - `theatrical` / `digital`: estreno de película en cines o en digital (región).
 * - `release`: lanzamiento sin más detalle (película sin región, juego).
 * - `chapter`: capítulo de manga (publicado o programado).
 */
export type CalendarKind =
  | 'episode'
  | 'season_premiere'
  | 'series_premiere'
  | 'theatrical'
  | 'digital'
  | 'release'
  | 'chapter'

/** Hasta dónde se sabe la fecha: un juego "2027" no es un día. */
export type DatePrecision = 'day' | 'month' | 'year' | 'tba'

/** Estado de biblioteca que entra en el calendario. */
export type CalendarStatus = 'in_progress' | 'pending'

export interface CalendarEvent {
  /** Único dentro de un calendario (clave de React y del correo). */
  id: string
  mediaId: string
  type: MediaType
  title: string
  poster: string | null
  status: CalendarStatus
  kind: CalendarKind
  /** AAAA-MM-DD en `CALENDAR_TIME_ZONE`; con precisión `month`/`year`, su primer día; null si `tba`. */
  date: string | null
  precision: DatePrecision
  /** HH:MM en `CALENDAR_TIME_ZONE` cuando el proveedor da la hora (AniList). */
  time?: string | null
  season?: number | null
  episode?: number | null
  /** Capítulo de manga tal cual lo da MangaDex ("112", "112.5"). */
  chapter?: string | null
  /** Nombre del episodio (TMDB), si lo hay. */
  episodeName?: string | null
  /** País del estreno de cine o digital (ISO 3166-1, "ES"). */
  region?: string | null
}

/** Un título de la biblioteca que se consulta. */
export interface CalendarCandidate {
  mediaId: string
  type: MediaType
  externalId: string
  title: string
  poster: string | null
  status: CalendarStatus
}

export interface CalendarResult {
  /** Ordenados por fecha (los `tba` al final). */
  events: CalendarEvent[]
  /** Títulos de la biblioteca que podían tener fecha. */
  candidates: number
  /** Cuántos se han consultado de verdad (presupuesto por petición). */
  checked: number
  /** Consultas que fallaron (proveedor caído, cupo…): el calendario es parcial. */
  failed: number
  /** Día de referencia (hoy en `CALENDAR_TIME_ZONE`). */
  today: string
}

/**
 * Las fechas de emisión que dan los proveedores son de calendario (TMDB, RAWG)
 * o instantes (AniList, MangaDex). Los instantes se pasan a la hora de España
 * peninsular, la de casi todo el público; la app no guarda la zona de cada uno.
 */
export const CALENDAR_TIME_ZONE = 'Europe/Madrid'

/** Días hacia delante que enseña la página. */
export const CALENDAR_DAYS_AHEAD = 90
/** Días hacia atrás para "recién salido" (capítulos y episodios de la semana). */
export const CALENDAR_DAYS_BACK = 7

const DAY_MS = 86_400_000

/** AAAA-MM-DD de un instante en la zona dada. */
export function dateInZone(instant: Date, timeZone: string = CALENDAR_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** HH:MM de un instante en la zona dada. */
export function timeInZone(instant: Date, timeZone: string = CALENDAR_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = ISO_DAY.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/** Suma días a un AAAA-MM-DD (sin desfases horarios). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Días entre dos AAAA-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  const toMs = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toMs(b) - toMs(a)) / DAY_MS)
}

/** Semana ISO 8601 de un AAAA-MM-DD: "2026-W51". */
export function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de un AAAA-MM-DD. */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

/** Orden del calendario: por fecha; a igual fecha, por hora y título; `tba` al final. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date === null || b.date === null) {
    if (a.date !== b.date) return a.date === null ? 1 : -1
  } else if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1
  }
  const ta = a.time ?? ''
  const tb = b.time ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.title.localeCompare(b.title)
}
