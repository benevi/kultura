import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import { LIBRARY_VISIBILITIES, type LibraryVisibility } from '@/lib/account/identity'
import { eyebrow, row, type AccountSettings } from './shared'

type Props = { libraryVisibility: LibraryVisibility } & Pick<AccountSettings, 'setLibraryVisibility'>

/**
 * Privacidad (D-04b): quién ve la biblioteca. Sin la migración o con la
 * bandera apagada no se monta y rige "cualquiera con cuenta".
 */
export function PrivacySection({ libraryVisibility, setLibraryVisibility }: Props) {
  const t = useTranslations('settings')

  return (
    <section>
      <p className={eyebrow}>{t('privacy')}</p>
      <div className={cn(row, 'flex flex-col gap-4 rounded-bento bg-surface-default')}>
        <div className="flex flex-col gap-1">
          <span id="library-visibility-label" className="text-sm font-semibold text-text-primary">
            {t('libraryVisibility')}
          </span>
          <span className="text-sm font-body text-text-tertiary">{t('libraryVisibilityHint')}</span>
        </div>
        <div role="radiogroup" aria-labelledby="library-visibility-label" className="flex flex-col gap-2">
          {LIBRARY_VISIBILITIES.map((option) => {
            const checked = libraryVisibility === option
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl bg-surface-elevated px-4 py-3 transition-colors',
                  checked && 'ring-2 ring-accent-pink'
                )}
              >
                <input
                  type="radio"
                  name="library-visibility"
                  value={option}
                  checked={checked}
                  onChange={() => setLibraryVisibility(option)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">{t(`visibility.${option}`)}</span>
                  <span className="text-xs font-body text-text-tertiary">{t(`visibility.${option}Hint`)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </section>
  )
}
