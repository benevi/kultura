// ============================================================
// KULTURA — MyAnimeList (F-26, D-15: segunda fuente)
//
// Profile → Export (myanimelist.net/panel.php?go=export): un `.xml.gz` (o el
// XML ya descomprimido) por lista, anime o manga:
//
//   <myanimelist>
//     <myinfo>…</myinfo>                ← nombre de usuario: NO se lee
//     <anime>
//       <series_animedb_id>1</series_animedb_id>
//       <series_title><![CDATA[Cowboy Bebop]]></series_title>
//       <my_watched_episodes>26</my_watched_episodes>
//       <my_finish_date>2020-04-05</my_finish_date>   (0000-00-00 = sin fecha)
//       <my_score>9</my_score>                         (0 = sin nota, 1-10)
//       <my_status>Completed</my_status>
//       <my_times_watched>0</my_times_watched>
//     </anime>
//     <manga> … <manga_mangadb_id>, <manga_title>, <my_read_chapters> … </manga>
//   </myanimelist>
//
// Estados (texto o, en exportaciones antiguas, número): Watching/Reading (1)
// → en curso; Completed (2) → completado; On-Hold (3) → en curso (KULTURA no
// tiene "en pausa"); Dropped (4) → abandonado; Plan to Watch/Read (6) →
// pendiente. El emparejado va por MAL ID (AniList `idMal`), sin búsqueda.
//
// Lector propio y mínimo (no hay DOMParser en el servidor ni hace falta): el
// XML de MAL es plano, sin atributos ni anidamiento dentro de cada entrada.
// ============================================================

import type { LibraryStatus } from '@/types/library'
import type { ImportItem, ImportLog, ImportWarning } from '../types'
import { cleanTitle, compactItem, toIsoDate, toPositiveInt } from './common'

export function isMalExport(text: string): boolean {
  return /<myanimelist[\s>]/i.test(text.slice(0, 4096))
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function safeCodePoint(n: number): string {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
}

/** Texto de una etiqueta: CDATA tal cual, el resto con entidades decodificadas. */
function tagText(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return cdata ? cdata[1] : decodeEntities(raw)
}

/** Bloques `<anime>`/`<manga>` → registro etiqueta → texto. */
export function readMalEntries(xml: string): Array<{ type: 'anime' | 'manga'; fields: Record<string, string> }> {
  const out: Array<{ type: 'anime' | 'manga'; fields: Record<string, string> }> = []
  const blockRe = /<(anime|manga)>([\s\S]*?)<\/\1>/g
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(xml)) !== null) {
    const fields: Record<string, string> = {}
    const fieldRe = /<([a-z_]+)>([\s\S]*?)<\/\1>/g
    let field: RegExpExecArray | null
    while ((field = fieldRe.exec(block[2])) !== null) fields[field[1]] = tagText(field[2]).trim()
    out.push({ type: block[1] as 'anime' | 'manga', fields })
  }
  return out
}

const STATUS_BY_TEXT: Record<string, LibraryStatus> = {
  watching: 'in_progress',
  reading: 'in_progress',
  completed: 'completed',
  'on-hold': 'in_progress',
  'on hold': 'in_progress',
  dropped: 'abandoned',
  'plan to watch': 'pending',
  'plan to read': 'pending',
  '1': 'in_progress',
  '2': 'completed',
  '3': 'in_progress',
  '4': 'abandoned',
  '6': 'pending',
}

export function parseMal(xml: string): { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] } {
  const items: Array<Omit<ImportItem, 'key'>> = []
  const seen = new Set<string>()
  let skipped = 0
  for (const { type, fields } of readMalEntries(xml)) {
    const mal = toPositiveInt(type === 'anime' ? fields.series_animedb_id : fields.manga_mangadb_id)
    const title = cleanTitle(type === 'anime' ? fields.series_title : fields.manga_title)
    const status = STATUS_BY_TEXT[(fields.my_status ?? '').trim().toLowerCase()]
    if (!mal || !title || !status || seen.has(`${type}:${mal}`)) {
      skipped++
      continue
    }
    seen.add(`${type}:${mal}`)
    const score = Number(fields.my_score)
    const rating10 = Number.isInteger(score) && score >= 1 && score <= 10 ? score : null
    const finished = toIsoDate(fields.my_finish_date)
    const logs: ImportLog[] =
      finished && status === 'completed'
        ? [{ watchedOn: finished, rewatch: false, rating10, review: null, spoiler: false }]
        : []
    items.push(
      compactItem({
        kind: type,
        title,
        ids: { mal },
        status,
        rating10,
        watchedAt: status === 'completed' ? finished : null,
        logs,
      })
    )
  }
  return { items, warnings: skipped > 0 ? [{ code: 'skipped_rows', count: skipped }] : [] }
}
