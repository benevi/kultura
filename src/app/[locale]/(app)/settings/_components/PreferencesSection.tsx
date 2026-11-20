import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/index'
import { eyebrow, row, type AccountSettings } from './shared'

type Props = Pick<AccountSettings, 'locale' | 'setLocale' | 'ratingScale' | 'scaleState' | 'handleRatingScale'>

/** Sección Preferencias: idioma y escala de notas. */
export function PreferencesSection({ locale, setLocale, ratingScale, scaleState, handleRatingScale }: Props) {
  const t = useTranslations('settings')

  return (
    <section>
      <p className={eyebrow}>{t('preferences')}</p>
      <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
        {/* Idioma */}
        <div role="group" aria-labelledby="settings-language-label" className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
          <span id="settings-language-label" className="text-sm font-semibold text-text-primary">{t('language')}</span>
          <div className="flex gap-2">
            {(['es', 'en'] as const).map(loc => (
              <button
                key={loc}
                type="button"
                // ACC-10: conmutador con estado; el nombre del idioma en su
                // propio idioma se pronuncia bien (WCAG 3.1.2).
                aria-pressed={locale === loc}
                lang={loc}
                onClick={() => setLocale(loc)}
                className={cn(
                  'min-h-11 rounded-pill px-4 py-2 text-sm font-bold font-body transition-colors',
                  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  locale === loc
                    ? 'bg-accent-positive text-on-accent-positive'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                )}
              >
                {loc === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* F-28: escala de notas (antes en la Biblioteca); se guarda sola. */}
        {ratingScale !== null && (
          <div className={cn(row, 'flex flex-col gap-3')}>
            <div className="flex flex-col gap-1">
              <span id="settings-rating-scale-label" className="text-sm font-semibold text-text-primary">
                {t('ratingScale')}
              </span>
              <span className="text-sm font-body text-text-tertiary">{t('ratingScaleHint')}</span>
            </div>
            <SegmentedControl
              ariaLabel={t('ratingScale')}
              value={ratingScale}
              onChange={handleRatingScale}
              options={[
                { value: 'stars', label: t('ratingScaleStars') },
                { value: 'ten', label: t('ratingScaleTen') },
              ]}
            />
            <p role="status" className="min-h-5 text-meta text-text-tertiary">
              {scaleState === 'saved' ? t('ratingScaleSaved') : ''}
            </p>
            {scaleState === 'error' && (
              <p role="alert" className="text-sm text-accent-danger">{t('ratingScaleError')}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
