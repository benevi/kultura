import { useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import { summarizeImport } from '@/lib/import/parse-file'
import type { ParsedImport } from '@/lib/import/types'
import { card } from './shared'
import type { ImportFlow } from './useImportFlow'

type Props = { parsed: ParsedImport } & Pick<
  ImportFlow,
  'ambiguousAs' | 'chooseAmbiguous' | 'previous' | 'start' | 'startOver' | 'reset'
>

const pill = 'rounded-pill bg-surface-elevated px-3 py-1.5 font-body text-sm font-bold text-text-primary'

/** Fase 2: qué se ha reconocido y cuánto, avisos y lo ya importado antes. */
export function ImportPreview({ parsed, ambiguousAs, chooseAmbiguous, previous, start, startOver, reset }: Props) {
  const t = useImportT()
  const summary = summarizeImport(parsed.items)
  const done = previous ? Array.from(previous.values()).filter((r) => r.outcome !== 'pending').length : 0

  return (
    <section aria-labelledby="import-preview" className={cn(card, 'flex flex-col gap-4')}>
      <h2 id="import-preview" className="font-display text-xl font-bold text-text-primary">
        {t('previewTitle', { source: t(`sources.${parsed.source}.name`), count: summary.total })}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {(['completed', 'in_progress', 'pending', 'abandoned'] as const).map((s) =>
          summary.byStatus[s] > 0 ? (
            <li key={s} className={pill}>
              {t(`summary.${s}`, { count: summary.byStatus[s] })}
            </li>
          ) : null
        )}
        {summary.rated > 0 ? <li className={pill}>{t('summary.rated', { count: summary.rated })}</li> : null}
        {summary.logs > 0 ? <li className={pill}>{t('summary.logs', { count: summary.logs })}</li> : null}
      </ul>
      <p className="break-words font-body text-xs text-text-tertiary">
        {t('previewFiles', { files: parsed.files.map((f) => f.split('/').pop()).join(', ') })}
      </p>

      {parsed.warnings.map((w) => (
        <p key={w.code} className="rounded-2xl bg-surface-elevated px-[18px] py-3 font-body text-sm text-text-secondary">
          {w.code === 'skipped_rows'
            ? t('warnings.skipped_rows', { count: w.count })
            : w.code === 'truncated'
              ? t('warnings.truncated', { count: w.count, max: w.max })
              : t(`warnings.${w.code}`)}
        </p>
      ))}

      {parsed.warnings.some((w) => w.code === 'ambiguous_list') && (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t('warnings.ambiguous_list')}</legend>
          {(['watched', 'watchlist'] as const).map((option) => (
            <label
              key={option}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl bg-surface-elevated px-4 py-3 font-body text-sm font-bold text-text-primary',
                ambiguousAs === option && 'ring-2 ring-accent-pink'
              )}
            >
              <input
                type="radio"
                name="import-ambiguous"
                checked={ambiguousAs === option}
                onChange={() => chooseAmbiguous(option)}
                className="h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
              />
              {option === 'watched' ? t('ambiguousWatched') : t('ambiguousWatchlist')}
            </label>
          ))}
        </fieldset>
      )}

      <p className="font-body text-sm text-text-tertiary">{t('keepNote')}</p>
      {done > 0 ? (
        <p role="status" className="font-body text-sm font-bold text-text-secondary">
          {t('resumeNote', { done, total: summary.total })}
        </p>
      ) : null}
      {done > 0 ? (
        <KButton type="button" variant="secondary" className="self-start" onClick={startOver}>
          {t('startOver')}
        </KButton>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <KButton type="button" variant="secondary" size="lg" onClick={reset}>
          {t('another')}
        </KButton>
        <KButton type="button" size="lg" onClick={() => void start(previous)}>
          {t('start', { count: summary.total })}
        </KButton>
      </div>
    </section>
  )
}
