// ============================================================
// KULTURA — Utilidades compartidas por los lectores de cada app (F-26)
// ============================================================

import { isValidDiaryDate } from '@/lib/library/diary'
import type { LibraryStatus } from '@/types/library'
import type { ImportItem, ImportLog } from '../types'
import { MAX_AUTHOR_LENGTH, MAX_LOGS_PER_ITEM, MAX_TITLE_LENGTH } from '../limits'
import { REVIEW_MAX } from '@/lib/library/diary'

/**
 * Fecha del archivo → AAAA-MM-DD válida (la misma regla que el diario:
 * 1900-mañana) o `null`. Acepta `2024-03-15`, `2024/03/15`,
 * `2024-03-15 21:04:11`, ISO con hora y zona; `0000-00-00` (MAL) es null.
 */
export function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!m) return null
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return isValidDiaryDate(iso) ? iso : null
}

/** Año razonable (1870-2100) o `undefined`. */
export function toYear(raw: string | number | null | undefined): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim().slice(0, 4))
  return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : undefined
}

/** Entero positivo o `undefined`. */
export function toPositiveInt(raw: string | null | undefined): number | undefined {
  const s = String(raw ?? '').trim()
  if (!/^\d{1,10}$/.test(s)) return undefined
  const n = Number(s)
  return n > 0 ? n : undefined
}

/** "Yes", "true", "1", "sí" → true. */
export function truthy(raw: string | null | undefined): boolean {
  return /^(yes|y|true|1|si|sí|x)$/i.test(String(raw ?? '').trim())
}

/** Título usable: espacios colapsados y con tope de longitud. */
export function cleanTitle(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH)
}

export function cleanAuthor(raw: string | null | undefined): string | undefined {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_AUTHOR_LENGTH)
  return s || undefined
}

/** Reseña en HTML sencillo (Goodreads usa `<br/>`) → texto, con el tope del diario. */
export function cleanReview(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text ? text.slice(0, REVIEW_MAX) : null
}

/** Orden de "avance" de un estado: al fusionar filas manda el que más avanza. */
export const STATUS_RANK: Record<LibraryStatus, number> = {
  pending: 0,
  abandoned: 1,
  in_progress: 2,
  completed: 3,
}

export function strongerStatus(a: LibraryStatus, b: LibraryStatus): LibraryStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a
}

/** Apuntes sin repetir (misma fecha y revisionado), los más recientes primero y con tope. */
export function dedupeLogs(logs: ImportLog[]): ImportLog[] {
  const byKey = new Map<string, ImportLog>()
  for (const log of logs) {
    const key = `${log.watchedOn}|${log.rewatch ? 1 : 0}`
    const prev = byKey.get(key)
    // Si se repite, se queda la que tenga más información.
    if (!prev) byKey.set(key, log)
    else
      byKey.set(key, {
        ...prev,
        rating10: prev.rating10 ?? log.rating10,
        review: prev.review ?? log.review,
        spoiler: prev.spoiler || log.spoiler,
      })
  }
  return Array.from(byKey.values())
    .sort((a, b) => (a.watchedOn < b.watchedOn ? 1 : a.watchedOn > b.watchedOn ? -1 : 0))
    .slice(0, MAX_LOGS_PER_ITEM)
}

/** La fecha más reciente de los apuntes (o `null`). */
export function latestLogDate(logs: ImportLog[] | undefined): string | null {
  if (!logs || logs.length === 0) return null
  return logs.reduce((max, l) => (l.watchedOn > max ? l.watchedOn : max), logs[0].watchedOn)
}

/** Sin claves vacías (para no mandar `logs: []` ni `ids: {}` al servidor). */
export function compactItem(item: Omit<ImportItem, 'key'>): Omit<ImportItem, 'key'> {
  const out: Omit<ImportItem, 'key'> = { ...item }
  if (out.logs && out.logs.length === 0) delete out.logs
  if (out.ids && Object.keys(out.ids).length === 0) delete out.ids
  if (out.year === undefined) delete out.year
  if (out.author === undefined) delete out.author
  return out
}
