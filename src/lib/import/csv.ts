// ============================================================
// KULTURA — Lector de CSV tolerante (F-26)
//
// Los CSV que llegan no son siempre los que exporta la app de origen: se
// abren y se guardan con Excel o Numbers por el camino. Lo que se ve en la
// práctica y este lector acepta:
//   - BOM UTF-8 al principio (Excel lo pone; la cabecera "Date" llegaba como
//     "\uFEFFDate" y no se reconocía).
//   - UTF-8 o, si no lo es, Windows-1252 (Excel en español guarda así).
//   - Separador coma, punto y coma (Excel con configuración regional
//     española) o tabulador: se elige mirando la cabecera.
//   - Comillas RFC 4180: comas, saltos de línea y "" dentro de un campo.
//   - Fin de línea CRLF, LF o CR; líneas en blanco.
//   - Columnas en cualquier orden y con mayúsculas o espacios distintos: se
//     leen por NOMBRE normalizado, nunca por posición.
//   - Valores al estilo Excel `="0439023483"` (ISBN de Goodreads).
// ============================================================

const BOM = '\uFEFF'

/** Bytes → texto: UTF-8 si lo es, si no Windows-1252. Sin BOM. */
export function decodeText(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.startsWith(BOM) ? text.slice(1) : text
}

/** Separador más probable mirando la primera línea (fuera de comillas). */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';'
  if (counts['\t'] > counts[',']) return '\t'
  return ','
}

/**
 * CSV → filas de celdas. RFC 4180 con tolerancia: una comilla en medio de un
 * campo sin comillas es literal, y una comilla sin cerrar se queda con el
 * resto del texto en vez de lanzar.
 */
export function parseCsvRows(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let fieldStarted = false

  const endField = () => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const endRow = () => {
    endField()
    // Una línea en blanco es una sola celda vacía: fuera.
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"' && !fieldStarted) {
      quoted = true
      fieldStarted = true
    } else if (ch === delimiter) {
      endField()
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      field += ch
      // Espacios antes de la comilla de apertura (`, "Título"`) no cuentan.
      if (ch !== ' ') fieldStarted = true
    }
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

/** Nombre de columna comparable: minúsculas, sin acentos ni espacios dobles. */
export function normalizeHeader(header: string): string {
  return header
    .replace(BOM, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/^"|"$/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
}

export interface CsvTable {
  /** Cabeceras normalizadas, en el orden del archivo. */
  headers: string[]
  /** Cada fila como cabecera normalizada → valor (sin espacios alrededor). */
  records: Array<Record<string, string>>
}

/** CSV con cabecera → registros por nombre de columna. */
export function parseCsvTable(text: string): CsvTable {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map(normalizeHeader)
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, i) => {
      // Cabecera repetida: manda la primera.
      if (header && !(header in record)) record[header] = (cells[i] ?? '').trim()
    })
    return record
  })
  return { headers, records }
}

/** Primer valor no vacío entre varios nombres de columna posibles. */
export function pick(record: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = record[name]
    if (value !== undefined && value !== '') return cleanExcelValue(value)
  }
  return ''
}

/** `="0439023483"` (Excel/Goodreads) → `0439023483`. */
export function cleanExcelValue(value: string): string {
  const m = value.match(/^="(.*)"$/)
  return (m ? m[1] : value).trim()
}

/** Escapa una celda para escribir CSV (RFC 4180). */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Filas → texto CSV con CRLF (lo que espera Excel y Letterboxd). */
export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
