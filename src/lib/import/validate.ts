// ============================================================
// KULTURA — Validación de un lote en el servidor (F-26)
//
// El navegador ya normaliza, pero el servidor no se fía: cada fila se valida
// campo a campo y con topes de longitud; lo que no pase es `invalid` (no
// tumba el lote). Las fechas y notas siguen las mismas reglas que el diario.
// ============================================================

import { isValidDiaryDate, REVIEW_MAX } from '@/lib/library/diary'
import { isValidRating10 } from '@/lib/library/rating'
import { isLibraryStatus } from '@/types/library'
import { MAX_AUTHOR_LENGTH, MAX_LOGS_PER_ITEM, MAX_TITLE_LENGTH } from './limits'
import { IMPORT_KINDS, type ImportItem, type ImportKind, type ImportLog } from './types'

const KEY_RE = /^[A-Za-z0-9_-]{1,20}$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const posInt = (v: unknown, max = 9_999_999_999) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max ? v : undefined)

function parseLog(raw: unknown): ImportLog | null {
  if (!isObject(raw) || !isValidDiaryDate(raw.watchedOn)) return null
  const review = typeof raw.review === 'string' && raw.review.trim() !== '' ? raw.review.trim().slice(0, REVIEW_MAX) : null
  return {
    watchedOn: raw.watchedOn,
    rewatch: raw.rewatch === true,
    rating10: isValidRating10(raw.rating10) ? raw.rating10 : null,
    review,
    spoiler: raw.spoiler === true,
  }
}

/** Una fila del lote o `null` si no se puede usar. */
export function parseImportItem(raw: unknown): ImportItem | null {
  if (!isObject(raw)) return null
  const { key, kind, title, status } = raw
  if (typeof key !== 'string' || !KEY_RE.test(key)) return null
  if (typeof kind !== 'string' || !(IMPORT_KINDS as readonly string[]).includes(kind)) return null
  if (typeof title !== 'string' || title.trim() === '' || title.length > MAX_TITLE_LENGTH) return null
  if (typeof status !== 'string' || !isLibraryStatus(status)) return null

  const item: ImportItem = {
    key,
    kind: kind as ImportKind,
    title: title.trim(),
    status,
    rating10: isValidRating10(raw.rating10) ? raw.rating10 : null,
    watchedAt: isValidDiaryDate(raw.watchedAt) ? raw.watchedAt : null,
  }
  const year = posInt(raw.year, 2100)
  if (year && year >= 1870) item.year = year
  if (typeof raw.author === 'string' && raw.author.trim()) item.author = raw.author.trim().slice(0, MAX_AUTHOR_LENGTH)

  if (isObject(raw.ids)) {
    const ids: NonNullable<ImportItem['ids']> = {}
    const tmdb = posInt(raw.ids.tmdb)
    const tvdb = posInt(raw.ids.tvdb)
    const mal = posInt(raw.ids.mal)
    if (tmdb) ids.tmdb = tmdb
    if (tvdb) ids.tvdb = tvdb
    if (mal) ids.mal = mal
    if (typeof raw.ids.imdb === 'string' && /^tt\d{5,10}$/.test(raw.ids.imdb)) ids.imdb = raw.ids.imdb
    if (Array.isArray(raw.ids.isbn)) {
      const isbn = raw.ids.isbn.filter((v): v is string => typeof v === 'string' && /^(\d{13}|\d{9}[\dX])$/.test(v)).slice(0, 3)
      if (isbn.length > 0) ids.isbn = isbn
    }
    if (Object.keys(ids).length > 0) item.ids = ids
  }

  if (Array.isArray(raw.logs)) {
    const logs = raw.logs.slice(0, MAX_LOGS_PER_ITEM).map(parseLog).filter((l): l is ImportLog => l !== null)
    if (logs.length > 0) item.logs = logs
  }
  return item
}

/**
 * Filas de un lote de POST /api/account/import/external (origen y tamaño ya
 * validados con `importBatchSchema`): las válidas, sin repetir clave, y las
 * claves de las que no valen (vuelven como `invalid`).
 */
export function splitImportItems(raws: readonly unknown[]): { items: ImportItem[]; invalidKeys: string[] } {
  const items: ImportItem[] = []
  const invalidKeys: string[] = []
  const seen = new Set<string>()
  for (const raw of raws) {
    const item = parseImportItem(raw)
    const key = isObject(raw) && typeof raw.key === 'string' && KEY_RE.test(raw.key) ? raw.key : null
    if (!item) {
      if (key && !seen.has(key)) invalidKeys.push(key)
      if (key) seen.add(key)
      continue
    }
    if (seen.has(item.key)) continue
    seen.add(item.key)
    items.push(item)
  }
  return { items, invalidKeys }
}
