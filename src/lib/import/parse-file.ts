// ============================================================
// KULTURA — Del archivo que sube la persona a filas importables (F-26)
//
// Corre en el NAVEGADOR: detecta la app de origen por el contenido (no por la
// extensión, que se pierde al renombrar), abre ZIP y .gz, aplica los límites
// de tamaño y filas y devuelve filas normalizadas con una clave estable.
// ============================================================

import { baseName, gunzip, isGzip, isZip, readZip } from './archive'
import { decodeText, parseCsvTable, type CsvTable } from './csv'
import { MAX_FILE_BYTES, MAX_IMPORT_ITEMS } from './limits'
import { isGoodreadsExport, parseGoodreads } from './parsers/goodreads'
import { isImdbExport, parseImdb } from './parsers/imdb'
import {
  isLetterboxdExport,
  isLetterboxdImportFormat,
  isLetterboxdZipEntry,
  parseLetterboxd,
  type LetterboxdOptions,
} from './parsers/letterboxd'
import { isMalExport, parseMal } from './parsers/mal'
import { isTvTimeExport, parseTvTime } from './parsers/tvtime'
import { STATUS_RANK } from './parsers/common'
import {
  ImportParseError,
  type ImportItem,
  type ImportSource,
  type ImportSummary,
  type ImportWarning,
  type ParsedImport,
} from './types'

export interface InputFile {
  name: string
  bytes: Uint8Array
}

interface TextFile {
  name: string
  text: string
}

/** Lo que interesa de un ZIP: CSV y XML (ni fotos ni JSON de perfil). */
function wantedInZip(path: string): boolean {
  const base = baseName(path)
  if (!/\.(csv|xml)$/.test(base)) return false
  // De Letterboxd solo los de la raíz; del resto (TV Time), cualquier CSV.
  const lower = path.toLowerCase()
  if (/(^|\/)(deleted|orphaned|lists|likes)\//.test(lower)) return false
  return true
}

async function expand(files: InputFile[]): Promise<TextFile[]> {
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0)
  if (total > MAX_FILE_BYTES) throw new ImportParseError('too_large')
  if (total === 0) throw new ImportParseError('empty')

  const out: TextFile[] = []
  for (const file of files) {
    if (isZip(file.bytes)) {
      for (const entry of await readZip(file.bytes, wantedInZip)) {
        out.push({ name: entry.name, text: decodeText(entry.bytes) })
      }
    } else if (isGzip(file.bytes)) {
      out.push({ name: file.name.replace(/\.gz$/i, ''), text: decodeText(await gunzip(file.bytes)) })
    } else {
      out.push({ name: file.name, text: decodeText(file.bytes) })
    }
  }
  return out
}

type Detected =
  | { source: 'mal'; file: TextFile }
  | { source: Exclude<ImportSource, 'mal'>; file: TextFile; table: CsvTable }

function detect(file: TextFile): Detected | null {
  const head = file.text.slice(0, 4096)
  if (/^\s*</.test(head)) return isMalExport(head) ? { source: 'mal', file } : null
  const table = parseCsvTable(file.text)
  const h = table.headers
  if (isLetterboxdExport(h)) {
    // En un ZIP de Letterboxd, solo los CSV de la raíz que sabemos leer.
    return file.name.includes('/') && !isLetterboxdZipEntry(file.name) ? null : { source: 'letterboxd', file, table }
  }
  if (isGoodreadsExport(h)) return { source: 'goodreads', file, table }
  if (isImdbExport(h)) return { source: 'imdb', file, table }
  if (isTvTimeExport(file.name, h)) return { source: 'tvtime', file, table }
  if (isLetterboxdImportFormat(h)) return { source: 'letterboxd', file, table }
  return null
}

export interface ParseOptions {
  letterboxd?: LetterboxdOptions
}

/**
 * Archivos subidos → filas importables. Lanza `ImportParseError` con un
 * código que la pantalla traduce (demasiado grande, formato desconocido…).
 */
export async function parseImportFiles(files: InputFile[], options: ParseOptions = {}): Promise<ParsedImport> {
  const texts = await expand(files)
  const detected = texts.map(detect).filter((d): d is Detected => d !== null)
  if (detected.length === 0) throw new ImportParseError('unknown_format')
  const sources = new Set(detected.map((d) => d.source))
  if (sources.size > 1) throw new ImportParseError('mixed_sources')
  const source = detected[0].source

  let parsed: { items: Array<Omit<ImportItem, 'key'>>; warnings: ImportWarning[] }
  switch (source) {
    case 'letterboxd':
      parsed = parseLetterboxd(
        detected.map((d) => ({ fileName: baseName(d.file.name), table: (d as { table: CsvTable }).table })),
        options.letterboxd
      )
      break
    case 'mal': {
      const all = detected.map((d) => parseMal(d.file.text))
      parsed = { items: all.flatMap((p) => p.items), warnings: mergeWarnings(all.flatMap((p) => p.warnings)) }
      break
    }
    case 'goodreads': {
      const all = detected.map((d) => parseGoodreads((d as { table: CsvTable }).table))
      parsed = { items: all.flatMap((p) => p.items), warnings: mergeWarnings(all.flatMap((p) => p.warnings)) }
      break
    }
    case 'imdb': {
      const all = detected.map((d) => parseImdb(baseName(d.file.name), (d as { table: CsvTable }).table))
      parsed = { items: all.flatMap((p) => p.items), warnings: mergeWarnings(all.flatMap((p) => p.warnings)) }
      break
    }
    case 'tvtime':
      parsed = parseTvTime(detected.map((d) => ({ fileName: baseName(d.file.name), table: (d as { table: CsvTable }).table })))
      break
  }

  if (parsed.items.length === 0) throw new ImportParseError('empty')
  const warnings = [...parsed.warnings]
  let items = parsed.items
  if (items.length > MAX_IMPORT_ITEMS) {
    warnings.push({ code: 'truncated', count: items.length - MAX_IMPORT_ITEMS, max: MAX_IMPORT_ITEMS })
    // Primero lo que más información trae (vistos con nota), lo último los pendientes.
    items = [...items]
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || Number(b.rating10 !== null) - Number(a.rating10 !== null))
      .slice(0, MAX_IMPORT_ITEMS)
  }
  return {
    source,
    items: items.map((item, i) => ({ ...item, key: String(i) })),
    warnings,
    files: detected.map((d) => d.file.name),
  }
}

function mergeWarnings(warnings: ImportWarning[]): ImportWarning[] {
  const skipped = warnings.reduce((n, w) => (w.code === 'skipped_rows' ? n + w.count : n), 0)
  const rest = warnings.filter((w) => w.code !== 'skipped_rows')
  return skipped > 0 ? [{ code: 'skipped_rows', count: skipped }, ...rest] : rest
}

/** Recuento para la vista previa. */
export function summarizeImport(items: ImportItem[]): ImportSummary {
  const summary: ImportSummary = {
    total: items.length,
    byStatus: { completed: 0, in_progress: 0, pending: 0, abandoned: 0 },
    byKind: {},
    rated: 0,
    logs: 0,
  }
  for (const item of items) {
    summary.byStatus[item.status]++
    summary.byKind[item.kind] = (summary.byKind[item.kind] ?? 0) + 1
    if (item.rating10 !== null) summary.rated++
    summary.logs += item.logs?.length ?? 0
  }
  return summary
}
