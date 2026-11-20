import Link from 'next/link'
import { useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import type { ImportOutcome, ParsedImport } from '@/lib/import/types'
import { ImportCounts } from './ImportCounts'
import { UnmatchedList } from './UnmatchedList'
import { useDownloadReport } from './report-download'
import { card } from './shared'
import type { ImportFlow } from './useImportFlow'

type Props = {
  locale: 'es' | 'en'
  compact: boolean
  parsed: ParsedImport
  counts: Record<ImportOutcome, number>
} & Pick<ImportFlow, 'statusRef' | 'diary' | 'results' | 'start' | 'reset'>

/** Fase 4: resumen, informe CSV y lo que no se pudo emparejar. */
export function ImportDone({ locale, compact, parsed, counts, statusRef, diary, results, start, reset }: Props) {
  const t = useImportT()
  const downloadReport = useDownloadReport(locale)
  const unmatched = parsed.items.filter((i) => results.get(i.key)?.outcome === 'unmatched')

  return (
    <section aria-labelledby="import-done" className={cn(card, 'flex flex-col gap-4')}>
      <h2 id="import-done" ref={statusRef} tabIndex={-1} className="font-display text-xl font-bold text-text-primary outline-none">
        {t('doneTitle')}
      </h2>
      <ImportCounts counts={counts} />
      {diary > 0 ? <p className="font-body text-sm text-text-secondary">{t('diaryImported', { count: diary })}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <KButton type="button" variant="secondary" onClick={() => downloadReport(parsed, results)}>
          {t('downloadReport')}
        </KButton>
        {counts.pending > 0 ? (
          <KButton type="button" variant="secondary" onClick={() => void start(results)}>
            {t('retryPending')}
          </KButton>
        ) : null}
        {!compact && (
          <KButton asChild>
            <Link href={`/${locale}/library`}>{t('toLibrary')}</Link>
          </KButton>
        )}
      </div>

      {unmatched.length > 0 ? <UnmatchedList locale={locale} unmatched={unmatched} /> : null}

      <KButton type="button" variant="secondary" className="self-start" onClick={reset}>
        {t('another')}
      </KButton>
    </section>
  )
}
