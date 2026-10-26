// ============================================================
// F-28 — Textos del calendario (es/en con los mensajes reales), secciones de
// la página y plantilla del correo (texto + HTML accesible y escapado).
// ============================================================

import { describe, it, expect } from 'vitest'
import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { dayHeading, describeEvent, laterHeading, sectionize, type CalendarT } from '@/lib/calendar/format'
import { addDays, compareEvents, dateInZone, isoWeek, isoWeekday, type CalendarEvent } from '@/lib/calendar/types'
import { buildWeeklyEmail, escapeHtml, WEEKLY_EMAIL_MAX_ITEMS } from '@/lib/email/weekly-template'
import { TODAY } from './fixtures'

const tEs = createTranslator({ locale: 'es', messages: es, namespace: 'calendar' }) as unknown as CalendarT
const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'calendar' }) as unknown as CalendarT

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: over.id ?? `${over.mediaId ?? 'tv_1'}:${over.kind ?? 'episode'}:${over.date ?? 'x'}`,
    mediaId: 'tv_1',
    type: 'tv',
    title: 'Serie',
    poster: null,
    status: 'in_progress',
    kind: 'episode',
    date: TODAY,
    precision: 'day',
    ...over,
  }
}

describe('fechas', () => {
  it('semana ISO y día de la semana', () => {
    expect(isoWeek('2026-12-14')).toBe('2026-W51')
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
    expect(isoWeek('2026-01-01')).toBe('2026-W01')
    expect(isoWeekday('2026-12-14')).toBe(1)
    expect(isoWeekday('2026-12-20')).toBe(7)
  })
  it('día en Madrid (cambio de día y de hora)', () => {
    expect(dateInZone(new Date('2026-12-14T23:30:00Z'))).toBe('2026-12-15')
    expect(dateInZone(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('describeEvent', () => {
  it.each([
    [ev({ season: 3, episode: 3, episodeName: 'Kilómetro cero' }), 'T3 · E3 · «Kilómetro cero»', 'S3 · E3 · “Kilómetro cero”'],
    [ev({ type: 'anime', episode: 1160, season: null, time: '10:30' }), 'Episodio 1160 · 10:30', 'Episode 1160 · 10:30'],
    [ev({ kind: 'season_premiere', season: 5 }), 'Estreno de la temporada 5', 'Season 5 premiere'],
    [ev({ kind: 'series_premiere' }), 'Estreno de la serie', 'Series premiere'],
    [ev({ kind: 'series_premiere', type: 'manga' }), 'Empieza a publicarse', 'Starts publishing'],
    [ev({ kind: 'theatrical', type: 'movie', region: 'ES' }), 'En cines en España', 'In theaters in Spain'],
    [ev({ kind: 'digital', type: 'movie', region: 'US' }), 'En digital en Estados Unidos', 'On digital in United States'],
    [ev({ kind: 'release', type: 'game' }), 'Lanzamiento', 'Release'],
    [ev({ kind: 'release', type: 'movie' }), 'Estreno', 'Premiere'],
    [ev({ kind: 'chapter', type: 'manga', chapter: '1170' }), 'Capítulo 1170 disponible', 'Chapter 1170 is out'],
    [ev({ kind: 'chapter', type: 'manga', chapter: '1171', time: '16:00' }), 'Capítulo 1171 · 16:00', 'Chapter 1171 · 16:00'],
  ])('%#', (event, esText, enText) => {
    expect(describeEvent(event, tEs, 'es')).toBe(esText)
    expect(describeEvent(event, tEn, 'en')).toBe(enText)
  })
})

describe('cabeceras y secciones', () => {
  it('hoy, mañana, ayer y el resto con el día de la semana', () => {
    expect(dayHeading(TODAY, TODAY, tEs, 'es')).toBe('Hoy')
    expect(dayHeading('2026-12-15', TODAY, tEn, 'en')).toBe('Tomorrow')
    expect(dayHeading('2026-12-13', TODAY, tEs, 'es')).toBe('Ayer')
    expect(dayHeading('2026-12-17', TODAY, tEs, 'es')).toBe('jueves, 17 de diciembre')
    expect(dayHeading('2027-01-04', TODAY, tEs, 'es')).toBe('lunes, 4 de enero de 2027')
  })

  it('lo que no tiene día: mes, año o sin fecha', () => {
    expect(laterHeading(ev({ date: '2027-04-01', precision: 'month' }), tEs, 'es')).toBe('abril de 2027')
    expect(laterHeading(ev({ date: '2027-01-01', precision: 'year' }), tEn, 'en')).toBe('In 2027')
    expect(laterHeading(ev({ date: null, precision: 'tba' }), tEs, 'es')).toBe('Sin fecha anunciada')
  })

  it('sectionize: próximos por día, recién salido al revés y "más adelante" ordenado', () => {
    const events = [
      ev({ id: 'a', date: '2026-12-07' }),
      ev({ id: 'b', date: '2026-12-12' }),
      ev({ id: 'c', date: TODAY }),
      ev({ id: 'd', date: TODAY, title: 'Otra' }),
      ev({ id: 'e', date: '2026-12-20' }),
      ev({ id: 'f', date: null, precision: 'tba' }),
      ev({ id: 'g', date: '2027-01-01', precision: 'year' }),
      ev({ id: 'h', date: '2027-04-01', precision: 'month' }),
    ].sort(compareEvents)
    const s = sectionize(events, TODAY)
    expect(s.upcoming.map((g) => [g.day, g.events.length])).toEqual([[TODAY, 2], ['2026-12-20', 1]])
    expect(s.recent.map((g) => g.day)).toEqual(['2026-12-12', '2026-12-07'])
    expect(s.later.map((g) => g.events[0].id)).toEqual(['h', 'g', 'f'])
  })
})

describe('correo semanal', () => {
  const base = {
    username: 'ana',
    events: [
      ev({ title: 'The Last of Us', season: 3, episode: 3, date: '2026-12-14' }),
      ev({ id: 'm', mediaId: 'movie_1', type: 'movie', kind: 'theatrical', region: 'ES', title: 'Vengadores', date: '2026-12-18' }),
    ],
    calendarUrl: 'https://kulturaapp.vercel.app/es/calendar?utm_source=email&utm_medium=email&utm_campaign=weekly-2026-W51',
    settingsUrl: 'https://kulturaapp.vercel.app/es/settings#email',
    unsubscribeUrl: 'https://kulturaapp.vercel.app/es/email/unsubscribe?t=v1.abc.def',
  }

  it('asunto con el recuento y texto plano con todo lo importante', () => {
    const mail = buildWeeklyEmail({ ...base, locale: 'es' })
    expect(mail.subject).toBe('Esta semana en KULTURA: 2 novedades')
    expect(mail.text).toContain('Hola, ana:')
    expect(mail.text).toContain('The Last of Us: T3 · E3')
    expect(mail.text).toContain('Vengadores: En cines en España')
    expect(mail.text).toContain(base.calendarUrl)
    expect(mail.text).toContain(`Darte de baja con un clic: ${base.unsubscribeUrl}`)
    expect(buildWeeklyEmail({ ...base, locale: 'en', events: base.events.slice(0, 1) }).subject).toBe('This week on KULTURA: 1 update')
  })

  it('HTML accesible: idioma, maquetación con role=presentation, un h1 y sin imágenes remotas', () => {
    const { html } = buildWeeklyEmail({ ...base, locale: 'en' })
    expect(html).toMatch(/^<!doctype html>\n<html lang="en">/)
    expect(html.match(/<table/g)?.length).toBe(html.match(/<table role="presentation"/g)?.length)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).not.toMatch(/<img|<script|url\(/i)
    expect(html).toContain('Open my calendar')
    expect(html).toContain('Unsubscribe')
  })

  it('escapa lo que viene de fuera (títulos y nombre) y quita saltos de línea', () => {
    const evil = ev({ title: '<img src=x onerror=alert(1)>\r\nBcc: x@y', season: 1, episode: 1 })
    const mail = buildWeeklyEmail({ ...base, locale: 'es', username: '"><script>', events: [evil] })
    expect(mail.html).not.toContain('<img src=x')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt; Bcc: x@y')
    expect(mail.text).not.toMatch(/\r|\nBcc/)
    expect(escapeHtml(`a&"'<>`)).toBe('a&amp;&quot;&#39;&lt;&gt;')
  })

  it(`como mucho ${WEEKLY_EMAIL_MAX_ITEMS} líneas y "y N más"`, () => {
    const many = Array.from({ length: WEEKLY_EMAIL_MAX_ITEMS + 3 }, (_, i) => ev({ id: `x${i}`, title: `T${i}` }))
    const mail = buildWeeklyEmail({ ...base, locale: 'es', events: many })
    expect(mail.text.match(/^· /gm)).toHaveLength(WEEKLY_EMAIL_MAX_ITEMS)
    expect(mail.text).toContain('Y 3 más en tu calendario.')
    expect(mail.subject).toBe(`Esta semana en KULTURA: ${WEEKLY_EMAIL_MAX_ITEMS + 3} novedades`)
  })
})
