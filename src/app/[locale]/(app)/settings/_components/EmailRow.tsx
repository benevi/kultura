import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { cn } from '@/lib/utils/index'
import { row, type AccountSettings } from './shared'

type Props = {
  userEmail: string
  isDemo: boolean
  emailConfirmed: boolean
} & Pick<
  AccountSettings,
  | 'emailFormOpen'
  | 'setEmailFormOpen'
  | 'newEmail'
  | 'setNewEmail'
  | 'emailError'
  | 'setEmailError'
  | 'emailSending'
  | 'emailSentTo'
  | 'setEmailSentTo'
  | 'newEmailRef'
  | 'handleChangeEmail'
>

/** Perfil › email actual y su cambio en línea. */
export function EmailRow({
  userEmail,
  isDemo,
  emailConfirmed,
  emailFormOpen,
  setEmailFormOpen,
  newEmail,
  setNewEmail,
  emailError,
  setEmailError,
  emailSending,
  emailSentTo,
  setEmailSentTo,
  newEmailRef,
  handleChangeEmail,
}: Props) {
  const t = useTranslations('settings')

  return (
    <div className={cn(row, 'flex flex-col gap-4')}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary">{t('email')}</span>
          <span className="select-all break-all text-sm text-text-tertiary">{userEmail}</span>
        </div>
        {!isDemo && !emailFormOpen && (
          <KButton
            variant="secondary"
            size="sm"
            className="flex-shrink-0"
            onClick={() => {
              setEmailFormOpen(true)
              setEmailSentTo(null)
              setEmailError('')
            }}
          >
            {t('changeEmail')}
          </KButton>
        )}
      </div>

      {(emailSentTo || emailConfirmed) && (
        <p role="status" className="text-sm font-body text-text-secondary">
          {emailSentTo ? t('changeEmailSent', { email: emailSentTo }) : t('emailConfirmed')}
        </p>
      )}

      {emailFormOpen && (
        <form onSubmit={handleChangeEmail} noValidate className="flex flex-col gap-3">
          <KInput
            ref={newEmailRef}
            id="new-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label={t('newEmail')}
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            error={emailError}
            hint={t('changeEmailHint')}
            aria-required="true"
            aria-invalid={emailError ? true : undefined}
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            <KButton type="submit" size="sm" loading={emailSending}>
              {t('changeEmailSubmit')}
            </KButton>
            <KButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setEmailFormOpen(false)
                setNewEmail('')
                setEmailError('')
              }}
            >
              {t('changeEmailCancel')}
            </KButton>
          </div>
        </form>
      )}
    </div>
  )
}
