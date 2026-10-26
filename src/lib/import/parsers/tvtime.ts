// ============================================================
// KULTURA — TV Time (F-26, D-15: opcional y el último; "beta")
//
// TV Time cerró el 15/07/2026 y solo dejó una exportación RGPD
// (gdpr.tvtime.com) sin formato documentado: un ZIP de CSV cuyos nombres y
// columnas han ido cambiando. Por eso este lector es TOLERANTE y se limita a
// lo seguro: el nombre de la serie o película y, si viene, su id de TheTVDB
// (TV Time usaba ids de TVDB), que TMDB `find` traduce sin buscar.
//
//   - Series seguidas (followed_tv_show.csv, user_tv_show_data.csv…) y
//     episodios vistos (seen_episode.csv, tracking-prod-records*.csv) → serie
//     "en curso" (el progreso por episodio es de F-27).
//   - Películas vistas (archivos o filas de tipo movie) → completadas.
//   - Listas "to watch"/"watchlist" → pendientes.
// Se agrupa por id (o nombre) para no crear una fila por episodio.
// ============================================================

import type { LibraryStatus } from '@/types/library'
import type { CsvTable } from '../csv'
import { pick } from '../csv'
import { normalizeTitle } from '../title-match'
import type { ImportItem, ImportKind, ImportWarning } from '../types'
import { cleanTitle, compactItem, strongerStatus, toIsoDate, toPositiveInt } from './common'

const NAME_COLUMNS = ['tv show name', 'series name', 'show name', 'movie name', 'title', 'name']
const ID_COLUMNS = ['tv show id', 'tvdb id', 'series id', 'tvdb show id', 'show id', 'movie id', 'tvdb']
/** Nombres de archivo que solo usa la exportación de TV Time. */
const FILE_HINT = /tv[\s_-]?time|followed[\s_-]?tv[\s_-]?show|tracking[\s_-]?prod|user[\s_-]?tv[\s_-]?show|seen[\s_-]?(episode|movie)/i

export function isTvTimeExport(fileName: string, headers: string[]): boolean {
  if (headers.includes('tv show name') || headers.includes('tv show id')) return true
  return FILE_HINT.test(fileName) && NAME_COLUMNS.some((c) => headers.includes(c))
}

export interface TvTimeInput {
  fileName: string
  table: CsvTable
}

export function parseTvTime(inputs: TvTimeInput[]): { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] } {
  const shows = new Map<string, Omit<ImportItem, 'key'>>()
  let skipped = 0
  for (const { fileName, table } of inputs) {
    const name = fileName.toLowerCase()
    const fileIsMovie = /movie/.test(name) || table.headers.includes('movie name')
    const fileStatus: LibraryStatus | null = /watch[\s_-]?list|to[\s_-]?watch|wish/.test(name) ? 'pending' : null
    for (const r of table.records) {
      const entity = pick(r, 'entity type', 'type').toLowerCase()
      const kind: ImportKind = fileIsMovie || entity === 'movie' ? 'movie' : 'tv'
      const title = cleanTitle(pick(r, ...NAME_COLUMNS))
      const tvdb = toPositiveInt(pick(r, ...ID_COLUMNS))
      if (!title) {
        skipped++
        continue
      }
      const status: LibraryStatus = fileStatus ?? (kind === 'movie' ? 'completed' : 'in_progress')
      const key = `${kind}:${tvdb ?? normalizeTitle(title)}`
      const when = toIsoDate(pick(r, 'watched at', 'seen at', 'created at', 'updated at'))
      const prev = shows.get(key)
      if (prev) {
        prev.status = strongerStatus(prev.status, status)
        if (when && (!prev.watchedAt || when > prev.watchedAt) && prev.status === 'completed') prev.watchedAt = when
        continue
      }
      shows.set(
        key,
        compactItem({
          kind,
          title,
          ids: tvdb ? { tvdb } : undefined,
          status,
          rating10: null,
          watchedAt: status === 'completed' ? when : null,
        })
      )
    }
  }
  return { items: Array.from(shows.values()), warnings: skipped > 0 ? [{ code: 'skipped_rows', count: skipped }] : [] }
}
