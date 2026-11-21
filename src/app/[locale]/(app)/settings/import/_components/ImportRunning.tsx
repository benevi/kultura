import { useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import type { ImportOutcome, ParsedImport } from '@/lib/import/types'
import { ImportCounts } from './ImportCounts'
import { ProgressBar } from './ProgressBar'
import { card } from './shared'
import type { ImportFlow } from './useImportFlow'

type Props = { parsed: ParsedImport; counts: Record<ImportOutcome, number> } & Pick<
  ImportFlow,
  'phase' | 'progress' | 'runError' | 'results' | 'start' | 'pause'
>

/** Fase 3: importando por lotes, con pausa y reanudación. */
export function ImportRunning({ parsed, counts, phase, progress, runError, results, start, pause }: Props) {
  const t = useImportT()
  return (
    <section aria-labelledby="import-running" className={cn(card, 'flex flex-col gap-4')}>
      <h2 id="import-running" className="font-display text-xl font-bold text-text-primary">
        {t(`sources.${parsed.source}.name`)}
      </h2>
      <ProgressBar label={t('progressLabel')} value={progress?.processed ?? 0} max={parsed.items.length} />
      <p role="status" className="font-body text-sm text-text-secondary">
        {phase === 'paused'
          ? runError
            ? t(`runErrors.${runError}`)
            : t('paused')
          : progress?.phase === 'retrying'
            ? t('retrying')
            : progress?.phase === 'waiting'
              ? t('waiting')
              : t('running', { processed: progress?.processed ?? 0, total: parsed.items.length })}
      </p>
      <ImportCounts counts={counts} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {phase === 'running' ? (
          <KButton type="button" variant="secondary" size="lg" onClick={pause}>
            {t('pause')}
          </KButton>
        ) : runError !== 'demo' && runError !== 'auth' ? (
          <KButton type="button" size="lg" onClick={() => void start(results)}>
            {t('resume')}
          </KButton>
        ) : null}
      </div>
    </section>
  )
}
