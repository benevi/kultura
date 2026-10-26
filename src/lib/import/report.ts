// ============================================================
// KULTURA — Informe de la importación (F-26): emparejados y no emparejados
//
// Se genera EN EL NAVEGADOR con lo que ya tiene (las filas del archivo y la
// respuesta de cada lote) y se descarga como CSV: con los datos de la
// persona, no pasa por el servidor ni se guarda en ninguna parte.
// ============================================================

import { csvCell } from './csv'
import type { ImportItem, ImportItemResult, ImportOutcome, MatchMethod } from './types'

export interface ReportLabels {
  headers: {
    title: string
    year: string
    result: string
    matchedTitle: string
    matchedYear: string
    method: string
    link: string
  }
  outcomes: Record<ImportOutcome, string>
  methods: Record<MatchMethod, string>
}

/**
 * Celda segura para hojas de cálculo: un título que empiece por `=`, `+`,
 * `-` o `@` se tomaría por fórmula al abrir el informe en Excel (inyección de
 * fórmulas). Se le antepone un apóstrofo, que Excel no muestra.
 */
export function spreadsheetSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/** `movie_550` → `/es/media/movie/550`. */
export function mediaPath(locale: string, mediaId: string): string {
  const i = mediaId.indexOf('_')
  return `/${locale}/media/${mediaId.slice(0, i)}/${encodeURIComponent(mediaId.slice(i + 1))}`
}

/** Orden del informe: primero lo que hay que revisar a mano. */
const ORDER: Record<ImportOutcome, number> = {
  unmatched: 0,
  pending: 1,
  invalid: 2,
  excluded: 3,
  added: 4,
  updated: 5,
  kept: 6,
}

export function buildReportCsv(
  items: ImportItem[],
  results: Map<string, ImportItemResult>,
  labels: ReportLabels,
  origin: string,
  locale: string
): string {
  const h = labels.headers
  const lines = [[h.title, h.year, h.result, h.matchedTitle, h.matchedYear, h.method, h.link].map(csvCell).join(',')]
  const rows = items
    .map((item) => ({ item, result: results.get(item.key) ?? { key: item.key, outcome: 'pending' as const } }))
    .sort((a, b) => ORDER[a.result.outcome] - ORDER[b.result.outcome] || Number(a.item.key) - Number(b.item.key))
  for (const { item, result } of rows) {
    lines.push(
      [
        spreadsheetSafe(item.title),
        item.year ?? '',
        labels.outcomes[result.outcome],
        spreadsheetSafe(result.title ?? ''),
        result.year ?? '',
        result.by ? labels.methods[result.by] : '',
        result.mediaId ? `${origin}${mediaPath(locale, result.mediaId)}` : '',
      ]
        .map(csvCell)
        .join(',')
    )
  }
  // BOM: Excel abre así el UTF-8 sin destrozar los acentos.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
