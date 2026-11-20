import { useTranslations, useLocale } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { purgeDate } from '@/lib/account/identity'
import { formatDay, type AccountSettings } from './shared'

type Props = { pendingDeletion: string } & Pick<AccountSettings, 'handleCancelDeletion' | 'cancellingDeletion'>

/** ROJO-7: borrado programado; mientras no venza, se puede deshacer. */
export function PendingDeletionBanner({ pendingDeletion, handleCancelDeletion, cancellingDeletion }: Props) {
  const t = useTranslations('settings')
  const currentLocale = useLocale()

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-4 rounded-bento border-2 border-accent-danger/50 bg-surface-default px-5 py-4 sm:px-6"
    >
      <p className="text-sm font-body text-text-primary">
        {t('deletionPending', { date: formatDay(purgeDate(pendingDeletion), currentLocale) })}
      </p>
      <KButton
        variant="secondary"
        size="sm"
        className="flex-shrink-0"
        onClick={handleCancelDeletion}
        loading={cancellingDeletion}
      >
        {t('cancelDeletion')}
      </KButton>
    </div>
  )
}
