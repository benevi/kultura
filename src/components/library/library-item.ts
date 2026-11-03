// ============================================================
// KULTURA — Una entrada de la Biblioteca, lista para pintar
// Tipo, id externo y orden de los títulos del álbum y de la lista. Puro, sin
// React: lo usan la vista de álbum, la lista y sus tests.
// ============================================================

import type { LibraryEntryWithProgress } from '@/lib/library/progress'
import { entryRating10 } from '@/lib/library/rating'
import type { LibraryStatus } from '@/types/library'
import type { MediaType } from '@/types/media'

/** Entrada con su progreso (F-27) y la última vez que se tocó (`updated_at`). */
export type LibraryItem = LibraryEntryWithProgress & { updatedAt?: string }

export function parseMediaId(mediaId: string): { type: MediaType; externalId: string } {
  const idx = mediaId.indexOf('_')
  return { type: mediaId.slice(0, idx) as MediaType, externalId: mediaId.slice(idx + 1) }
}

export function itemHref(item: Pick<LibraryItem, 'mediaId'>): `/media/${string}/${string}` {
  const { type, externalId } = parseMediaId(item.mediaId)
  return `/media/${type}/${externalId}`
}

/** Última vez que se tocó; sin `updated_at`, cuando se añadió. */
export function touchedTime(item: LibraryItem): number {
  const t = new Date(item.updatedAt ?? item.createdAt).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Las páginas del álbum, en el orden en que se enseñan: lo que llevas entre manos primero. */
export const ALBUM_STATUSES: readonly LibraryStatus[] = ['in_progress', 'pending', 'completed', 'abandoned']

export type LibrarySort = 'recent' | 'added' | 'title' | 'rating' | 'year'
export const LIBRARY_SORTS: readonly LibrarySort[] = ['recent', 'added', 'title', 'rating', 'year']

export function isLibrarySort(value: string | null | undefined): value is LibrarySort {
  return (LIBRARY_SORTS as readonly string[]).includes(value ?? '')
}

const created = (i: LibraryItem) => new Date(i.createdAt).getTime() || 0

/** Orden de la lista. Lo que no tiene dato (nota, año) va al final. */
export function sortItems(items: readonly LibraryItem[], sort: LibrarySort, locale: string): LibraryItem[] {
  const out = items.slice()
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  switch (sort) {
    case 'added':
      return out.sort((a, b) => created(b) - created(a))
    case 'title':
      return out.sort((a, b) => collator.compare(a.title ?? '', b.title ?? ''))
    case 'rating':
      return out.sort((a, b) => (entryRating10(b) ?? -1) - (entryRating10(a) ?? -1) || touchedTime(b) - touchedTime(a))
    case 'year':
      return out.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || collator.compare(a.title ?? '', b.title ?? ''))
    default:
      return out.sort((a, b) => touchedTime(b) - touchedTime(a))
  }
}

/**
 * Orden de una página del álbum. Los pendientes son huecos numerados: van por
 * fecha de alta (el hueco 1 es lo primero que quisiste, y su número no cambia
 * al añadir otro); el resto, lo último que tocaste primero.
 */
export function albumOrder(items: readonly LibraryItem[], status: LibraryStatus): LibraryItem[] {
  const out = items.slice()
  return status === 'pending'
    ? out.sort((a, b) => created(a) - created(b))
    : out.sort((a, b) => touchedTime(b) - touchedTime(a))
}

/** Búsqueda por título sin acentos ni mayúsculas. */
export function matchesQuery(item: LibraryItem, query: string): boolean {
  const q = fold(query.trim())
  return q === '' || fold(item.title ?? '').includes(q)
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
