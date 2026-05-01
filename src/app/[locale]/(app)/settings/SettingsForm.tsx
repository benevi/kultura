'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToastContext } from '@/components/ui/ToastProvider'
import { AVATAR_COLORS, isValidAvatarColor } from '@/lib/constants/avatarColors'
import type { AvatarColorName } from '@/lib/constants/avatarColors'
import Link from 'next/link'

interface SettingsFormProps {
  initialUsername: string
  initialAvatarColor: string
  initialLocale: string | null
  userEmail: string
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/

export function SettingsForm({
  initialUsername,
  initialAvatarColor,
  initialLocale,
  userEmail,
}: SettingsFormProps) {
  const t = useTranslations('settings')
  const currentLocale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToastContext()

  const safeInitialColor: AvatarColorName = isValidAvatarColor(initialAvatarColor)
    ? initialAvatarColor
    : 'blue'

  const [username, setUsername] = useState(initialUsername)
  const [avatarColor, setAvatarColor] = useState<AvatarColorName>(safeInitialColor)
  const [locale, setLocale] = useState(initialLocale ?? currentLocale)
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  function validateUsername(value: string): string {
    if (value.length < 3) return t('errorInvalidUsername')
    if (value.length > 20) return t('errorInvalidUsername')
    if (!USERNAME_REGEX.test(value)) return t('errorInvalidUsername')
    return ''
  }

  function handleUsernameChange(value: string) {
    setUsername(value)
    if (usernameError) setUsernameError(validateUsername(value))
  }

  async function handleSave() {
    const validationError = validateUsername(username)
    if (validationError) {
      setUsernameError(validationError)
      return
    }
    setUsernameError('')
    setSaving(true)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatar_color: avatarColor, preferred_locale: locale }),
      })

      if (res.status === 409) {
        setUsernameError(t('errorUsernameExists'))
        return
      }

      if (!res.ok) {
        toast.show({ message: t('errorSave') ?? 'Error al guardar', type: 'error' })
        return
      }

      toast.show({ message: t('saved'), type: 'success' })

      if (locale !== currentLocale) {
        const newPath = pathname.replace(`/${currentLocale}/`, `/${locale}/`)
        router.push(newPath)
      }
    } catch {
      toast.show({ message: t('errorSave') ?? 'Error al guardar', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-text">{t('title')}</h1>

      {/* Sección Perfil */}
      <section className="flex flex-col gap-6 bg-surface rounded-xl p-6 border border-border">
        <h2 className="text-lg font-semibold text-text">{t('profile')}</h2>

        {/* Email (solo lectura) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('email')}</label>
          <p className="text-sm text-text px-3 py-2 bg-surface2 rounded-md border border-border opacity-60 select-all">
            {userEmail}
          </p>
        </div>

        {/* Username */}
        <Input
          label={t('username')}
          value={username}
          onChange={e => handleUsernameChange(e.target.value)}
          placeholder={t('usernamePlaceholder')}
          error={usernameError}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Color de avatar */}
        <div className="flex flex-col gap-3">
          <label className="text-sm text-muted">{t('avatarColor')}</label>
          <div className="grid grid-cols-8 gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color.name}
                type="button"
                aria-label={color.name}
                onClick={() => setAvatarColor(color.name)}
                className={[
                  'w-8 h-8 rounded-full transition-transform hover:scale-110',
                  avatarColor === color.name
                    ? 'ring-2 ring-offset-2 ring-offset-surface ring-white scale-110'
                    : '',
                ].join(' ')}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">{t('changePasswordHint') ?? 'Te enviaremos un email con el enlace de restablecimiento'}</p>
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href={`/${currentLocale}/login?mode=reset`}>{t('changePassword')}</Link>
          </Button>
        </div>
      </section>

      {/* Sección Preferencias */}
      <section className="flex flex-col gap-6 bg-surface rounded-xl p-6 border border-border">
        <h2 className="text-lg font-semibold text-text">{t('preferences')}</h2>

        {/* Idioma */}
        <div className="flex flex-col gap-3">
          <label className="text-sm text-muted">{t('language')}</label>
          <div className="flex gap-2">
            {(['es', 'en'] as const).map(loc => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={[
                  'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                  locale === loc
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface2 text-text border-border hover:border-muted',
                ].join(' ')}
              >
                {loc === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sección Zona de peligro */}
      <section className="flex flex-col gap-3 bg-red-950/20 border border-red-900/30 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-text">{t('dangerZone')}</h2>
        <p className="text-sm text-muted">{t('deleteAccountSoon')}</p>
      </section>

      {/* Botón guardar */}
      <Button onClick={handleSave} loading={saving} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </div>
  )
}
