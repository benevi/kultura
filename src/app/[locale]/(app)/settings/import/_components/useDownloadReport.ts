// Informe CSV de la importación: textos del idioma y descarga en el navegador.
import { useImportT } from '@/lib/import/i18n'
import { buildReportCsv, type ReportLabels } from '@/lib/import/report'
import { IMPORT_OUTCOMES, type ImportItemResult, type ImportOutcome, type ParsedImport } from '@/lib/import/types'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Descarga del informe CSV con los textos del idioma. Es un hook para que el
 * traductor sea el de `useImportT` (el test de claves muertas lo sigue).
 */
export function useDownloadReport(locale: 'es' | 'en') {
  const t = useImportT()
  return (parsed: ParsedImport, results: Map<string, ImportItemResult>) => {
    const labels: ReportLabels = {
      headers: {
        title: t('report.title'),
        year: t('report.year'),
        result: t('report.result'),
        matchedTitle: t('report.matchedTitle'),
        matchedYear: t('report.matchedYear'),
        method: t('report.method'),
        link: t('report.link'),
      },
      outcomes: Object.fromEntries(IMPORT_OUTCOMES.map((o) => [o, t(`report.outcomes.${o}`)])) as Record<ImportOutcome, string>,
      methods: {
        tmdb: t('report.methods.tmdb'),
        imdb: t('report.methods.imdb'),
        tvdb: t('report.methods.tvdb'),
        mal: t('report.methods.mal'),
        isbn: t('report.methods.isbn'),
        title_year: t('report.methods.title_year'),
        title: t('report.methods.title'),
      },
    }
    const csv = buildReportCsv(parsed.items, results, labels, window.location.origin, locale)
    download(`${t('report.fileName')}-${parsed.source}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
  }
}
