import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils/index'
import { eyebrow, formatDay, row, type AccountSettings } from './shared'

type Props = {
  isDemo: boolean
  weeklyEmail: NonNullable<AccountSettings['weeklyEmail']>
} & Pick<AccountSettings, 'weeklyState' | 'handleWeeklyEmail'>

/**
 * F-28 (CRE-9): correo semanal, opt-in con doble confirmación por correo y el
 * texto que se acepta a la vista; la base registra versión y fecha al confirmar.
 */
export function WeeklyEmailSection({ isDemo, weeklyEmail, weeklyState, handleWeeklyEmail }: Props) {
  const t = useTranslations('settings')
  const currentLocale = useLocale()

  return (
    <section id="email" className="scroll-mt-20">
      <p className={eyebrow}>{t('emailSection')}</p>
      <div className={cn(row, 'flex flex-col gap-3 rounded-bento bg-surface-default')}>
        {/* Nombre corto en la etiqueta y el texto que se acepta como
            descripción: el lector no lo repite dos veces. */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="weekly-email-switch" className="cursor-pointer text-sm font-semibold text-text-primary">
              {t('weeklyEmail')}
            </label>
            <p id="weekly-email-consent" className="text-sm font-body text-text-tertiary">
              {t('weeklyEmailConsent')}
            </p>
            {!weeklyEmail.weekly && <p className="text-meta text-text-tertiary">{t('weeklyEmailHowTo')}</p>}
          </div>
          <input
            id="weekly-email-switch"
            type="checkbox"
            role="switch"
            checked={weeklyEmail.weekly}
            aria-describedby="weekly-email-consent"
            disabled={isDemo || weeklyState === 'saving'}
            onChange={(e) => handleWeeklyEmail(e.target.checked)}
            className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer accent-accent-pink disabled:cursor-not-allowed"
          />
        </div>
        {isDemo && <p className="text-sm text-text-tertiary">{t('weeklyEmailDemo')}</p>}
        {weeklyEmail.weekly && weeklyEmail.consentedAt ? (
          <p className="text-meta text-text-tertiary">
            {t('weeklyEmailSince', { date: formatDay(new Date(weeklyEmail.consentedAt), currentLocale) })}{' '}
            <Link href={`/${currentLocale}/calendar`} className="font-semibold text-text-secondary underline hover:text-text-primary">
              {t('weeklyEmailCalendar')}
            </Link>
          </p>
        ) : null}
        <p role="status" className="min-h-5 text-meta text-text-tertiary">
          {weeklyState === 'on'
            ? t('weeklyEmailOn')
            : weeklyState === 'off'
              ? t('weeklyEmailOff')
              : weeklyState === 'pending'
                ? t('weeklyEmailPending')
                : weeklyState === 'cooldown'
                  ? t('weeklyEmailCooldown')
                  : weeklyState === 'dailyLimit'
                    ? t('weeklyEmailDailyLimit')
                    : weeklyState === 'busy'
                      ? t('weeklyEmailBusy')
                      : ''}
        </p>
        {(weeklyState === 'error' || weeklyState === 'stale' || weeklyState === 'unconfirmed' || weeklyState === 'sendFailed') && (
          <p role="alert" className="text-sm text-accent-danger">
            {weeklyState === 'stale'
              ? t('weeklyEmailStale')
              : weeklyState === 'unconfirmed'
                ? t('weeklyEmailUnconfirmed')
                : weeklyState === 'sendFailed'
                  ? t('weeklyEmailSendFailed')
                  : t('weeklyEmailError')}
          </p>
        )}
      </div>
    </section>
  )
}
