import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { cn } from '@/lib/utils/index'
import { EmailRow } from './EmailRow'
import { AvatarColorRow, AvatarIconRow } from './AvatarRows'
import { eyebrow, row, type AccountSettings } from './shared'

type Props = {
  userEmail: string
  isDemo: boolean
  emailConfirmed: boolean
  settings: AccountSettings
}

/** Sección Perfil: email, nombre, color y personaje del avatar, contraseña. */
export function ProfileSection({ userEmail, isDemo, emailConfirmed, settings }: Props) {
  const t = useTranslations('settings')
  const currentLocale = useLocale()

  return (
    <section>
      <p className={eyebrow}>{t('profile')}</p>
      <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
        <EmailRow
          userEmail={userEmail}
          isDemo={isDemo}
          emailConfirmed={emailConfirmed}
          emailFormOpen={settings.emailFormOpen}
          setEmailFormOpen={settings.setEmailFormOpen}
          newEmail={settings.newEmail}
          setNewEmail={settings.setNewEmail}
          emailError={settings.emailError}
          setEmailError={settings.setEmailError}
          emailSending={settings.emailSending}
          emailSentTo={settings.emailSentTo}
          setEmailSentTo={settings.setEmailSentTo}
          newEmailRef={settings.newEmailRef}
          handleChangeEmail={settings.handleChangeEmail}
        />

        {/* Username */}
        <div className={row}>
          <KInput
            ref={settings.usernameRef}
            id="username"
            label={t('username')}
            value={settings.username}
            onChange={e => settings.handleUsernameChange(e.target.value)}
            placeholder={t('usernamePlaceholder')}
            error={settings.usernameError}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <AvatarColorRow avatarColor={settings.avatarColor} setAvatarColor={settings.setAvatarColor} />

        <AvatarIconRow avatarIcon={settings.avatarIcon} setAvatarIcon={settings.setAvatarIcon} />

        {/* Cambiar contraseña: directo a la pantalla de contraseña nueva,
            que funciona con la sesión abierta (R1). Antes llevaba al
            formulario de "enviar enlace", que no cambiaba nada. */}
        <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
          {isDemo ? (
            <p className="text-sm font-body text-text-tertiary">{t('demoCredentialsLocked')}</p>
          ) : (
            <>
              <p className="text-sm font-body text-text-tertiary max-w-xs">{t('changePasswordHint')}</p>
              <KButton variant="secondary" size="sm" className="flex-shrink-0" asChild>
                <Link
                  href={`/${currentLocale}/reset-password?next=${encodeURIComponent(`/${currentLocale}/settings`)}`}
                >
                  {t('changePassword')}
                </Link>
              </KButton>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
