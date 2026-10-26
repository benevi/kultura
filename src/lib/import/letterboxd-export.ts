// ============================================================
// KULTURA — Exportar a CSV compatible con Letterboxd (F-26, PRO criterio 8)
//
// Formato de IMPORTACIÓN de Letterboxd (letterboxd.com/about/importing-data):
// columnas por nombre, en cualquier orden; Letterboxd empareja primero por
// `tmdbID`, que es justo el id de las películas de KULTURA (`movie_{tmdb}`),
// así que no depende del título. Columnas que se escriben:
//   tmdbID, Title, Year, Rating (0,5-5 en medias), WatchedDate (AAAA-MM-DD),
//   Rewatch (true/false), Review
// Solo películas (Letterboxd no tiene series ni otros formatos).
//   - "watched": lo visto (completado). Con diario (F-24), una fila por
//     apunte (fecha, revisionado, nota de ese día y reseña); si no, una fila
//     con la fecha y la nota de la biblioteca.
//   - "watchlist": lo pendiente (Letterboxd lo importa en Watchlist → Import).
// El mismo CSV se puede volver a importar en KULTURA (lo lee el importador
// de Letterboxd por su `tmdbID`).
// ============================================================

import { isValidRating10, rating10ToHalfStars } from '@/lib/library/rating'
import { toCsv } from './csv'
import { spreadsheetSafe } from './report'

export type LetterboxdExportList = 'watched' | 'watchlist'

export const LETTERBOXD_EXPORT_HEADERS = ['tmdbID', 'Title', 'Year', 'Rating', 'WatchedDate', 'Rewatch', 'Review'] as const

export interface ExportEntry {
  mediaId: string
  status: string
  rating10: number | null
  watchedAt: string | null
  title: string | null
  year: number | null
}

export interface ExportLog {
  mediaId: string
  watchedOn: string
  rewatch: boolean
  rating10: number | null
  review: string | null
}

/** `movie_550` → 550; cualquier otra cosa (series, anime…) → null. */
export function tmdbMovieId(mediaId: string): number | null {
  const m = mediaId.match(/^movie_(\d{1,10})$/)
  return m ? Number(m[1]) : null
}

/**
 * rating10 → estrellas de Letterboxd ("4.5"); vacío sin nota. Letterboxd
 * solo admite medias estrellas: un 7,5/10 (D-14) se redondea a 4★, como lo
 * pinta `StarRating`.
 */
export function letterboxdStars(rating10: number | null): string {
  return isValidRating10(rating10) ? String(rating10ToHalfStars(rating10)) : ''
}

export function buildLetterboxdCsv(list: LetterboxdExportList, entries: ExportEntry[], logs: ExportLog[] = []): string {
  const logsByMedia = new Map<string, ExportLog[]>()
  for (const l of logs) {
    const arr = logsByMedia.get(l.mediaId) ?? []
    arr.push(l)
    logsByMedia.set(l.mediaId, arr)
  }

  const rows: Array<Array<string | number | null>> = [Array.from(LETTERBOXD_EXPORT_HEADERS)]
  for (const e of entries) {
    const tmdb = tmdbMovieId(e.mediaId)
    if (tmdb === null) continue
    // Título y reseña son texto libre: si empiezan por =, +, -, @, tabulador o
    // retorno, Excel/Sheets los tomaría por fórmula al abrir el CSV (igual que
    // en el informe). Letterboxd empareja por tmdbID, así que el apóstrofo no
    // le afecta, y el importador de KULTURA lo quita al leerlo.
    const base = [tmdb, spreadsheetSafe(e.title ?? ''), e.year ?? ''] as const
    if (list === 'watchlist') {
      if (e.status !== 'pending') continue
      rows.push([...base, '', '', '', ''])
      continue
    }
    if (e.status !== 'completed') continue
    const entryLogs = (logsByMedia.get(e.mediaId) ?? []).sort((a, b) => (a.watchedOn < b.watchedOn ? -1 : 1))
    if (entryLogs.length === 0) {
      rows.push([...base, letterboxdStars(e.rating10), e.watchedAt ?? '', 'false', ''])
      continue
    }
    for (const l of entryLogs) {
      rows.push([...base, letterboxdStars(l.rating10 ?? e.rating10), l.watchedOn, l.rewatch ? 'true' : 'false', spreadsheetSafe(l.review ?? '')])
    }
  }
  return toCsv(rows)
}
