// ============================================================
// KULTURA — Letterboxd (F-26, D-15: la primera fuente)
//
// Exportación de Letterboxd (Settings → Data → Export your data): un ZIP con
// estos CSV en la raíz (columnas documentadas por Letterboxd):
//   ratings.csv   Date, Name, Year, Letterboxd URI, Rating
//   diary.csv     Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
//   reviews.csv   Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags, Watched Date
//   watched.csv   Date, Name, Year, Letterboxd URI
//   watchlist.csv Date, Name, Year, Letterboxd URI
// (y carpetas `lists/`, `likes/`, `deleted/`, `orphaned/` que no se usan: lo
// borrado no debe volver).
//
// Ojo: el "Letterboxd URI" del diario es el del APUNTE, no el de la película,
// así que las filas de una misma película se juntan por título normalizado +
// año. No traen id de IMDb ni de TMDB: se empareja por título + año contra
// TMDB (de donde Letterboxd saca sus fichas, así que coinciden casi siempre).
//
// También se lee el formato de IMPORTACIÓN de Letterboxd (tmdbID, imdbID,
// Title, Year, Rating, Rating10, WatchedDate, Rewatch, Review), que es el que
// exporta KULTURA y el de muchas herramientas: ahí sí hay ids y se usan.
//
// Notas ½★ → rating10 sin pérdida (4,5★ → 9) con `letterboxdToRating10`.
// ============================================================

import { letterboxdToRating10, isValidRating10 } from '@/lib/library/rating'
import type { CsvTable } from '../csv'
import { pick } from '../csv'
import { normalizeTitle } from '../title-match'
import type { ImportItem, ImportLog, ImportWarning } from '../types'
import { cleanReview, cleanTitle, compactItem, dedupeLogs, latestLogDate, toIsoDate, toPositiveInt, toYear, truthy } from './common'

export type LetterboxdFile = 'ratings' | 'diary' | 'reviews' | 'watched' | 'watchlist'

/** ¿Cabecera de una exportación nativa de Letterboxd? */
export function isLetterboxdExport(headers: string[]): boolean {
  return headers.includes('letterboxd uri') && headers.includes('name')
}

/** ¿Cabecera del formato de importación de Letterboxd (tmdbID, Title, Rating10…)? */
export function isLetterboxdImportFormat(headers: string[]): boolean {
  if (headers.includes('tmdbid') || headers.includes('imdbid') || headers.includes('letterboxduri')) return true
  return headers.includes('title') && (headers.includes('rating10') || headers.includes('watcheddate'))
}

/** Qué CSV es, por su nombre o, si lo han renombrado, por sus columnas. */
export function letterboxdFileKind(fileName: string, headers: string[]): { kind: LetterboxdFile; ambiguous: boolean } {
  const name = fileName.toLowerCase()
  if (name.includes('watchlist')) return { kind: 'watchlist', ambiguous: false }
  if (headers.includes('review')) return { kind: 'reviews', ambiguous: false }
  if (headers.includes('watched date')) return { kind: 'diary', ambiguous: false }
  if (headers.includes('rating')) return { kind: 'ratings', ambiguous: false }
  if (name.includes('watched')) return { kind: 'watched', ambiguous: false }
  // Date, Name, Year, URI sin nombre que lo diga: igual puede ser vistas que pendientes.
  return { kind: 'watched', ambiguous: true }
}

/** Rutas del ZIP que se leen (solo la raíz: `deleted/diary.csv` no vuelve). */
export function isLetterboxdZipEntry(path: string): boolean {
  const parts = path.toLowerCase().split('/').filter(Boolean)
  const base = parts[parts.length - 1] ?? ''
  if (parts.some((p) => ['deleted', 'orphaned', 'lists', 'likes'].includes(p))) return false
  return ['ratings.csv', 'diary.csv', 'reviews.csv', 'watched.csv', 'watchlist.csv'].includes(base)
}

interface Film {
  title: string
  year?: number
  watched: boolean
  inWatchlist: boolean
  /** Nota actual (ratings.csv). */
  rating10: number | null
  /** Nota del último apunte, si no hay nota actual. */
  lastLogRating: { on: string; rating10: number } | null
  logs: ImportLog[]
  ids?: ImportItem['ids']
}

export interface LetterboxdInput {
  fileName: string
  table: CsvTable
}

export interface LetterboxdOptions {
  /** Cómo tratar un CSV ambiguo (Date, Name, Year, URI): vistas o pendientes. */
  ambiguousAs?: 'watched' | 'watchlist'
}

export function parseLetterboxd(
  inputs: LetterboxdInput[],
  options: LetterboxdOptions = {}
): { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] } {
  const films = new Map<string, Film>()
  const warnings: ImportWarning[] = []
  let skipped = 0
  let ambiguous = false

  const film = (title: string, year: number | undefined, ids?: ImportItem['ids']): Film => {
    // Con id de TMDB/IMDb (formato de importación) se agrupa por id.
    const key = ids?.tmdb ? `tmdb:${ids.tmdb}` : ids?.imdb ? `imdb:${ids.imdb}` : `${normalizeTitle(title)}|${year ?? ''}`
    let f = films.get(key)
    if (!f) {
      f = { title, year, watched: false, inWatchlist: false, rating10: null, lastLogRating: null, logs: [], ids }
      films.set(key, f)
    }
    return f
  }

  // Primero el diario y luego las reseñas: así cada reseña se cuelga de su apunte.
  const order: Record<LetterboxdFile, number> = { ratings: 0, watched: 1, watchlist: 2, diary: 3, reviews: 4 }
  const tagged = inputs.map((input) => {
    if (isLetterboxdImportFormat(input.table.headers) && !isLetterboxdExport(input.table.headers)) {
      return { input, kind: null as LetterboxdFile | null }
    }
    const { kind, ambiguous: amb } = letterboxdFileKind(input.fileName, input.table.headers)
    if (amb) ambiguous = true
    return { input, kind: amb && options.ambiguousAs === 'watchlist' ? ('watchlist' as const) : kind }
  })
  tagged.sort((a, b) => (a.kind ? order[a.kind] : -1) - (b.kind ? order[b.kind] : -1))

  for (const { input, kind } of tagged) {
    if (kind === null) {
      skipped += readImportFormat(input, film)
      continue
    }
    for (const r of input.table.records) {
      const title = cleanTitle(pick(r, 'name'))
      if (!title) {
        skipped++
        continue
      }
      const f = film(title, toYear(pick(r, 'year')))
      const rating10 = letterboxdToRating10(pick(r, 'rating'))
      if (kind === 'watchlist') {
        f.inWatchlist = true
        continue
      }
      f.watched = true
      if (kind === 'ratings') {
        if (rating10 !== null) f.rating10 = rating10
        continue
      }
      if (kind === 'watched') continue

      // diary / reviews: un apunte con fecha de visionado (o la del registro).
      const watchedOn = toIsoDate(pick(r, 'watched date')) ?? toIsoDate(pick(r, 'date'))
      if (!watchedOn) continue
      const rewatch = truthy(pick(r, 'rewatch'))
      const review = kind === 'reviews' ? cleanReview(pick(r, 'review')) : null
      if (rating10 !== null && (!f.lastLogRating || watchedOn >= f.lastLogRating.on)) {
        f.lastLogRating = { on: watchedOn, rating10 }
      }
      const same = f.logs.find((l) => l.watchedOn === watchedOn && l.rewatch === rewatch && (kind !== 'reviews' || !l.review))
      if (same) {
        if (review) same.review = review
        if (same.rating10 === null) same.rating10 = rating10
      } else {
        f.logs.push({ watchedOn, rewatch, rating10, review, spoiler: false })
      }
    }
  }

  if (skipped > 0) warnings.push({ code: 'skipped_rows', count: skipped })
  if (ambiguous) warnings.push({ code: 'ambiguous_list' })

  const items = Array.from(films.values()).map((f) => {
    const logs = dedupeLogs(f.logs)
    return compactItem({
      kind: 'movie',
      title: f.title,
      year: f.year,
      ids: f.ids,
      status: f.watched ? 'completed' : 'pending',
      rating10: f.rating10 ?? f.lastLogRating?.rating10 ?? null,
      watchedAt: latestLogDate(logs),
      logs,
    })
  })
  return { items, warnings }
}

/**
 * Quita el apóstrofo con el que el export de KULTURA neutraliza las fórmulas
 * de hoja de cálculo (`'=…` → `=…`).
 */
function unescapeFormula<T extends string | null>(value: T): T {
  return (value === null ? value : value.replace(/^'(?=[=+\-@\t\r])/, '')) as T
}

/** Formato de importación de Letterboxd: una fila = una película vista (o un apunte). */
function readImportFormat(
  input: LetterboxdInput,
  film: (title: string, year: number | undefined, ids?: ImportItem['ids']) => Film
): number {
  let skipped = 0
  const watchlist = input.fileName.toLowerCase().includes('watchlist')
  for (const r of input.table.records) {
    const title = unescapeFormula(cleanTitle(pick(r, 'title', 'name')))
    const tmdb = toPositiveInt(pick(r, 'tmdbid'))
    const imdbRaw = pick(r, 'imdbid')
    const imdb = /^tt\d{5,10}$/.test(imdbRaw) ? imdbRaw : undefined
    if (!title && !tmdb && !imdb) {
      skipped++
      continue
    }
    const ids: ImportItem['ids'] = {}
    if (tmdb) ids.tmdb = tmdb
    if (imdb) ids.imdb = imdb
    const f = film(title || imdb || String(tmdb), toYear(pick(r, 'year')), ids)
    if (watchlist) {
      f.inWatchlist = true
      continue
    }
    f.watched = true
    const rating10Raw = Number(pick(r, 'rating10'))
    const rating10 = isValidRating10(rating10Raw) ? rating10Raw : letterboxdToRating10(pick(r, 'rating'))
    const watchedOn = toIsoDate(pick(r, 'watcheddate', 'watched date'))
    if (watchedOn) {
      if (rating10 !== null && (!f.lastLogRating || watchedOn >= f.lastLogRating.on)) {
        f.lastLogRating = { on: watchedOn, rating10 }
      }
      f.logs.push({
        watchedOn,
        rewatch: truthy(pick(r, 'rewatch')),
        rating10,
        review: unescapeFormula(cleanReview(pick(r, 'review'))),
        spoiler: false,
      })
    } else if (rating10 !== null) {
      f.rating10 = rating10
    }
  }
  return skipped
}
