'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import { AVATAR_COLORS, isValidAvatarColor } from '@/lib/constants/avatarColors'
import type { AvatarColorName } from '@/lib/constants/avatarColors'
import { cn } from '@/lib/utils/index'
import { createClient } from '@/lib/supabase/client'
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
  const [exporting, setExporting] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleExportData() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        toast.show({ message: t('exportDataError'), type: 'error' })
        return
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kultura-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.show({ message: t('exportDataError'), type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        toast.show({ message: t('deleteAccountError'), type: 'error' })
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      toast.show({ message: t('deleteAccountError'), type: 'error' })
    } finally {
      setDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold text-text-primary">{t('title')}</h1>

      {/* Sección Perfil */}
      <section className="flex flex-col gap-6 rounded-modal border border-surface-border bg-surface-default p-6">
        <h2 className="font-display text-lg font-medium text-text-primary">{t('profile')}</h2>

        {/* Email (solo lectura) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-body text-text-secondary">{t('email')}</label>
          <p className="select-all rounded-button border border-surface-border bg-surface-base px-3 py-2 text-sm font-body text-text-primary opacity-60">
            {userEmail}
          </p>
        </div>

        {/* Username */}
        <KInput
          id="username"
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
          <label className="text-sm font-body text-text-secondary">{t('avatarColor')}</label>
          <div className="grid grid-cols-8 gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color.name}
                type="button"
                aria-label={color.name}
                onClick={() => setAvatarColor(color.name)}
                className={cn(
                  'h-8 w-8 rounded-full transition-transform hover:scale-110',
                  avatarColor === color.name
                    ? 'scale-110 ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default'
                    : ''
                )}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-body text-text-tertiary">
            {t('changePasswordHint') ?? 'Te enviaremos un email con el enlace de restablecimiento'}
          </p>
          <KButton variant="secondary" size="sm" className="w-fit" asChild>
            <Link href={`/${currentLocale}/login?mode=reset`}>{t('changePassword')}</Link>
          </KButton>
        </div>
      </section>

      {/* Sección Preferencias */}
      <section className="flex flex-col gap-6 rounded-modal border border-surface-border bg-surface-default p-6">
        <h2 className="font-display text-lg font-medium text-text-primary">{t('preferences')}</h2>

        {/* Idioma */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-body text-text-secondary">{t('language')}</label>
          <div className="flex gap-2">
            {(['es', 'en'] as const).map(loc => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={cn(
                  'rounded-pill px-4 py-2 text-sm font-medium font-body border transition-colors',
                  locale === loc
                    ? 'bg-accent-positive text-on-accent-positive border-accent-positive'
                    : 'bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary'
                )}
              >
                {loc === 'es' ? 'Español' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sección Zona de peligro (D2/D3) */}
      <section className="flex flex-col gap-4 rounded-modal border border-surface-border bg-surface-default p-4">
        <h2 className="font-display text-lg font-medium text-text-secondary">{t('dangerZone')}</h2>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-body text-text-tertiary">{t('exportDataHint')}</p>
          <KButton
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={handleExportData}
            loading={exporting}
          >
            {t('exportData')}
          </KButton>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-surface-border">
          <p className="text-sm font-body text-text-tertiary">{t('deleteAccountHint')}</p>
          <KButton
            variant="secondary"
            size="sm"
            className="w-fit border-danger/40 text-danger hover:bg-danger/10"
            onClick={() => setDeleteModalOpen(true)}
          >
            {t('deleteAccount')}
          </KButton>
        </div>
      </section>

      {/* Botón guardar */}
      <KButton onClick={handleSave} loading={saving} className="w-full sm:w-fit">
        {saving ? t('saving') : t('save')}
      </KButton>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title={t('deleteAccountConfirmTitle')}
        message={t('deleteAccountConfirmMessage')}
        confirmLabel={t('deleteAccountConfirmButton')}
        cancelLabel={t('deleteAccountCancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteModalOpen(false)}
        isDestructive
        loading={deleting}
      />
    </div>
  )
}
