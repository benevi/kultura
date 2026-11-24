// ============================================================
// KULTURA — Orden de la Biblioteca (fase 8.5 B2, bandera SALA_BIBLIOTECA).
// Puro: sirve en cliente y en tests. Solo usa lo que ya trae la página
// (`created_at`, título, año y nota): ni consulta ni columna nuevas.
//
// - `recent` (por defecto): el orden del servidor, los añadidos hace menos
//   primero (`getUserMedia` ordena por `created_at` descendente).
// - `title`: A-Z con las reglas del idioma de la página.
// - `year`: los más nuevos primero.
// - `rating`: la nota más alta primero.
// Lo que no tiene el dato (sin año, sin nota) va al final, en el orden de
// `recent`. El orden es estable: a igualdad, manda `recent`.
// ============================================================

import { storedRating10 } from '@/lib/library/rating'
import type { LibraryEntry } from '@/types/library'

export const LIBRARY_SORTS = ['recent', 'title', 'year', 'rating'] as const
export type LibrarySort = (typeof LIBRARY_SORTS)[number]

/** El orden de la URL (`?sort=`). Uno que no existe es el de siempre. */
export function parseLibrarySort(raw: string | null | undefined): LibrarySort {
  return (LIBRARY_SORTS as readonly string[]).includes(raw ?? '') ? (raw as LibrarySort) : 'recent'
}

/** Nota guardada en 0,5-10: la fina si la hay; si no, la entera de siempre. */
export function entryRating10(entry: LibraryEntry): number | null {
  return storedRating10(entry.rating10) ?? (entry.score ? entry.score * 2 : null)
}

/** Primero los que tienen dato; entre ellos, el mayor. */
function desc(a: number | null | undefined, b: number | null | undefined): number {
  const hasA = typeof a === 'number'
  const hasB = typeof b === 'number'
  if (hasA && hasB) return b - a
  if (hasA) return -1
  if (hasB) return 1
  return 0
}

export function sortLibrary<T extends LibraryEntry>(entries: readonly T[], sort: LibrarySort, locale: string): T[] {
  if (sort === 'recent') return [...entries]
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const indexed = entries.map((entry, index) => ({ entry, index }))
  indexed.sort((a, b) => {
    let diff = 0
    if (sort === 'title') diff = collator.compare(a.entry.title ?? a.entry.mediaId, b.entry.title ?? b.entry.mediaId)
    else if (sort === 'year') diff = desc(a.entry.year, b.entry.year)
    else diff = desc(entryRating10(a.entry), entryRating10(b.entry))
    return diff !== 0 ? diff : a.index - b.index
  })
  return indexed.map((x) => x.entry)
}
