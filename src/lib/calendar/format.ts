// ============================================================
// KULTURA — Calendario (F-28): textos de cada evento y de cada fecha
// Comunes a la página y al correo semanal. `t` es el traductor del namespace
// `calendar` (next-intl en la página, `createTranslator` en el correo).
// ============================================================

import { addDays, daysBetween, type CalendarEvent } from './types'

export type CalendarT = (key: string, values?: Record<string, string | number>) => string

function intlLocale(locale: string): string {
  return locale === 'en' ? 'en-GB' : 'es-ES'
}

/** "España", "Estados Unidos"… en el idioma de quien lee. */
export function countryName(region: string, locale: string): string {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: 'region' }).of(region) ?? region
  } catch {
    return region
  }
}

/** Qué pasa: "T2 · E5 · «Nombre» · 17:30", "Estreno en cines en España"… */
export function describeEvent(e: CalendarEvent, t: CalendarT, locale: string): string {
  let label: string
  switch (e.kind) {
    case 'episode':
      label =
        e.season !== null && e.season !== undefined && e.type !== 'anime'
          ? t('episodeSeason', { season: e.season, episode: e.episode ?? 0 })
          : t('episodeOnly', { episode: e.episode ?? 0 })
      if (e.episodeName) label = t('withName', { label, name: e.episodeName })
      break
    case 'season_premiere':
      label = t('seasonPremiere', { season: e.season ?? 0 })
      break
    case 'series_premiere':
      label = t('seriesPremiere', { type: e.type })
      break
    case 'theatrical':
    case 'digital':
      label = t(e.kind, { country: countryName(e.region ?? '', locale) })
      break
    case 'release':
      label = t('release', { type: e.type })
      break
    case 'chapter':
      label = t(e.time ? 'chapterNext' : 'chapterOut', { chapter: e.chapter ?? '' })
      break
  }
  return e.time ? t('withTime', { label, time: e.time }) : label
}

/** Cabecera de un día: "Hoy", "Mañana", "jueves, 29 de octubre". */
export function dayHeading(day: string, today: string, t: CalendarT, locale: string): string {
  const diff = daysBetween(today, day)
  if (diff === 0) return t('today')
  if (diff === 1) return t('tomorrow')
  if (diff === -1) return t('yesterday')
  const [y, m, d] = day.split('-').map(Number)
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Fecha corta para el correo: "lun 21 dic" / "Mon 21 Dec". */
export function shortDay(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Cabecera de lo que no tiene día exacto: "diciembre de 2026", "En 2027", "Sin fecha anunciada". */
export function laterHeading(e: CalendarEvent, t: CalendarT, locale: string): string {
  if (e.precision === 'tba' || e.date === null) return t('tba')
  if (e.precision === 'year') return t('inYear', { year: e.date.slice(0, 4) })
  const [y, m] = e.date.split('-').map(Number)
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
}

export interface CalendarSections {
  /** Días con algo desde hoy, en orden. */
  upcoming: Array<{ day: string; events: CalendarEvent[] }>
  /** Sin día exacto (mes, año o por anunciar). */
  later: Array<{ heading: CalendarEvent; events: CalendarEvent[] }>
  /** Lo de los últimos 7 días, de lo más reciente a lo más antiguo. */
  recent: Array<{ day: string; events: CalendarEvent[] }>
}

/** Reparte los eventos (ya ordenados) en las tres secciones de la página. */
export function sectionize(events: CalendarEvent[], today: string): CalendarSections {
  const upcoming = new Map<string, CalendarEvent[]>()
  const recent = new Map<string, CalendarEvent[]>()
  const later = new Map<string, { heading: CalendarEvent; events: CalendarEvent[] }>()
  const weekAgo = addDays(today, -7)
  for (const e of events) {
    if (e.precision !== 'day' || e.date === null) {
      const key = e.precision === 'tba' || e.date === null ? 'tba' : e.precision === 'year' ? e.date.slice(0, 4) : e.date.slice(0, 7)
      const group = later.get(key) ?? { heading: e, events: [] }
      group.events.push(e)
      later.set(key, group)
    } else if (e.date >= today) {
      upcoming.set(e.date, [...(upcoming.get(e.date) ?? []), e])
    } else if (e.date >= weekAgo) {
      recent.set(e.date, [...(recent.get(e.date) ?? []), e])
    }
  }
  return {
    upcoming: [...upcoming].map(([day, list]) => ({ day, events: list })),
    // Los meses antes que los años y "sin fecha" al final.
    later: [...later.entries()]
      .sort(([a], [b]) => {
        const rank = (k: string) => (k === 'tba' ? 2 : k.length === 4 ? 1 : 0)
        return rank(a) - rank(b) || a.localeCompare(b)
      })
      .map(([, g]) => g),
    recent: [...recent].map(([day, list]) => ({ day, events: list })).reverse(),
  }
}
