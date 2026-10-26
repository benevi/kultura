// ============================================================
// KULTURA — Goodreads (F-26, D-15: tercera fuente)
//
// My Books → Import and export → Export Library: `goodreads_library_export.csv`
// con (entre otras) Book Id, Title, Author, Author l-f, ISBN, ISBN13,
// My Rating, Year Published, Original Publication Year, Date Read, Date Added,
// Exclusive Shelf, My Review, Spoiler, Read Count. Los ISBN llegan con forma
// de fórmula de Excel (`="9780439023481"`) y vacíos como `=""`.
//
// Estantería exclusiva → estado: read → completado, currently-reading → en
// curso, to-read → pendiente; las propias del tipo "dnf", "did-not-finish" o
// "abandoned" → abandonado; cualquier otra, pendiente.
// Nota 1-5 entera (0 = sin nota) → rating10 = ×2.
// Emparejado: por ISBN-13 / ISBN-10 en Open Library y, si no hay, título +
// autor.
// ============================================================

import type { LibraryStatus } from '@/types/library'
import type { CsvTable } from '../csv'
import { pick } from '../csv'
import { stripSeriesSuffix } from '../title-match'
import type { ImportItem, ImportLog, ImportWarning } from '../types'
import { cleanAuthor, cleanReview, cleanTitle, compactItem, toIsoDate, toYear, truthy } from './common'

export function isGoodreadsExport(headers: string[]): boolean {
  return headers.includes('exclusive shelf') || (headers.includes('book id') && headers.includes('isbn13'))
}

function shelfStatus(shelf: string): LibraryStatus {
  const s = shelf.trim().toLowerCase()
  if (s === 'read') return 'completed'
  if (s === 'currently-reading') return 'in_progress'
  if (/dnf|did-?not-?finish|abandon|dropped/.test(s)) return 'abandoned'
  return 'pending'
}

/** ISBN-10 o ISBN-13 sin guiones; `null` si no tiene forma de ISBN. */
export function cleanIsbn(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase()
  if (/^\d{13}$/.test(s)) return s
  if (/^\d{9}[\dX]$/.test(s)) return s
  return null
}

export function parseGoodreads(table: CsvTable): { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] } {
  const items: Array<Omit<ImportItem, 'key'>> = []
  let skipped = 0
  for (const r of table.records) {
    const title = cleanTitle(stripSeriesSuffix(pick(r, 'title')))
    if (!title) {
      skipped++
      continue
    }
    const isbn = [cleanIsbn(pick(r, 'isbn13')), cleanIsbn(pick(r, 'isbn'))].filter((v): v is string => !!v)
    const status = shelfStatus(pick(r, 'exclusive shelf') || 'to-read')
    const stars = Number(pick(r, 'my rating'))
    const rating10 = Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars * 2 : null
    const dateRead = toIsoDate(pick(r, 'date read'))
    const review = cleanReview(pick(r, 'my review'))
    const readCount = Number(pick(r, 'read count')) || 0

    // Un apunte de diario con la fecha de lectura. Sin ella pero con reseña
    // de un libro leído, la única fecha que hay es la de alta en Goodreads:
    // se usa para no perder la reseña.
    const logs: ImportLog[] = []
    const logDate = dateRead ?? (review && status === 'completed' ? toIsoDate(pick(r, 'date added')) : null)
    if (logDate && status === 'completed') {
      logs.push({ watchedOn: logDate, rewatch: readCount > 1, rating10, review, spoiler: truthy(pick(r, 'spoiler')) })
    }

    items.push(
      compactItem({
        kind: 'book',
        title,
        year: toYear(pick(r, 'original publication year')) ?? toYear(pick(r, 'year published')),
        author: cleanAuthor(pick(r, 'author', 'author l-f')),
        ids: isbn.length > 0 ? { isbn } : undefined,
        status,
        rating10,
        watchedAt: status === 'completed' ? dateRead : null,
        logs,
      })
    )
  }
  return { items, warnings: skipped > 0 ? [{ code: 'skipped_rows', count: skipped }] : [] }
}
