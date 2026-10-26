// ============================================================
// KULTURA — IMDb (F-26): "Your ratings" y "Watchlist" → Export
//
// Columnas documentadas por IMDb: Const (tt…), Your Rating (1-10), Date Rated,
// Title, Original Title, URL, Title Type, Year, … y, en la watchlist,
// Position/Created/Modified. Va por IMDb ID con TMDB `find`, sin buscar por
// título: el emparejado es exacto.
// ============================================================

import type { CsvTable } from '../csv'
import { pick } from '../csv'
import type { ImportItem, ImportKind, ImportWarning } from '../types'
import { cleanTitle, compactItem, toYear } from './common'

export function isImdbExport(headers: string[]): boolean {
  return headers.includes('const') && headers.includes('title type')
}

/** Tipo de título de IMDb → formato de KULTURA (episodios, juegos… fuera). */
export function imdbKind(titleType: string): ImportKind | null {
  const t = titleType.toLowerCase().replace(/[\s_-]+/g, '')
  if (['movie', 'tvmovie', 'short', 'video', 'tvshort', 'tvspecial', 'musicvideo'].includes(t)) {
    return t === 'musicvideo' ? null : 'movie'
  }
  if (['tvseries', 'tvminiseries'].includes(t)) return 'tv'
  return null
}

export function parseImdb(fileName: string, table: CsvTable): { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] } {
  const watchlist = fileName.toLowerCase().includes('watchlist') || table.headers.includes('position')
  const items: Array<Omit<ImportItem, 'key'>> = []
  let skipped = 0
  for (const r of table.records) {
    const imdb = pick(r, 'const')
    const kind = imdbKind(pick(r, 'title type'))
    const title = cleanTitle(pick(r, 'title', 'original title'))
    if (!/^tt\d{5,10}$/.test(imdb) || !kind || !title) {
      skipped++
      continue
    }
    const score = Number(pick(r, 'your rating'))
    const rating10 = Number.isInteger(score) && score >= 1 && score <= 10 ? score : null
    items.push(
      compactItem({
        kind,
        title,
        year: toYear(pick(r, 'year')),
        ids: { imdb },
        status: watchlist && rating10 === null ? 'pending' : 'completed',
        rating10,
        watchedAt: null,
      })
    )
  }
  return { items, warnings: skipped > 0 ? [{ code: 'skipped_rows', count: skipped }] : [] }
}
