'use client'

import { useRef, useState } from 'react'
import { PageHeading } from '@/components/layout/PageHeading'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import { AVATAR_COLORS, isValidAvatarColor } from '@/lib/constants/avatarColors'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import type { AvatarColorName } from '@/lib/constants/avatarColors'
import { cn } from '@/lib/utils/index'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKeyFromError } from '@/lib/utils/auth-errors'
import Link from 'next/link'

interface SettingsFormProps {
  initialUsername: string
  initialAvatarColor: string
  initialAvatarIcon: string | null
  initialLocale: string | null
  userEmail: string
  /** Cuenta demo: no puede cambiar email ni contraseña (la comparte todo el mundo). */
  isDemo?: boolean
  /** Se vuelve del enlace de cambio de email. */
  emailConfirmed?: boolean
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/

export function SettingsForm({
  initialUsername,
  initialAvatarColor,
  initialAvatarIcon,
  initialLocale,
  userEmail,
  isDemo = false,
  emailConfirmed = false,
}: SettingsFormProps) {
  const t = useTranslations('settings')
  const tErrors = useTranslations('errors')
  const currentLocale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToastContext()

  const safeInitialColor: AvatarColorName = isValidAvatarColor(initialAvatarColor)
    ? initialAvatarColor
    : 'blue'

  const [username, setUsername] = useState(initialUsername)
  const [avatarColor, setAvatarColor] = useState<AvatarColorName>(safeInitialColor)
  const [avatarIcon, setAvatarIcon] = useState<string | null>(initialAvatarIcon)
  const [locale, setLocale] = useState(initialLocale ?? currentLocale)
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Cambio de email (R1 / art. 16 RGPD): formulario en línea.
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)
  const newEmailRef = useRef<HTMLInputElement>(null)

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
        body: JSON.stringify({
          username,
          avatar_color: avatarColor,
          preferred_locale: locale,
          // Solo se envía si el usuario lo tocó: mandar la columna cuando su
          // migración aún no está aplicada haría fallar TODO el guardado,
          // incluidos nombre e idioma.
          ...(avatarIcon !== initialAvatarIcon ? { avatar_icon: avatarIcon } : {}),
        }),
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

      // El header lo pinta el layout en el SERVIDOR: sin refrescarlo, el avatar
      // seguía mostrando las iniciales viejas hasta recargar a mano.
      router.refresh()

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

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    const value = newEmail.trim()
    let error = ''
    if (!value.includes('@') || !value.includes('.')) error = tErrors('invalidEmail')
    else if (value.toLowerCase() === userEmail.toLowerCase()) error = t('changeEmailSame')
    setEmailError(error)
    if (error) {
      newEmailRef.current?.focus()
      return
    }

    setEmailSending(true)
    try {
      const supabase = createClient()
      const next = `/${currentLocale}/settings?email=confirmed`
      const { error: updateError } = await supabase.auth.updateUser(
        { email: value },
        {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        }
      )
      if (updateError) {
        setEmailError(tErrors(getAuthErrorKeyFromError(updateError)))
        newEmailRef.current?.focus()
        return
      }
      setEmailSentTo(value)
      setEmailFormOpen(false)
      setNewEmail('')
    } catch {
      setEmailError(tErrors('somethingWentWrong'))
    } finally {
      setEmailSending(false)
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

  async function handleImportData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // El input se resetea siempre: si no, reimportar el MISMO fichero tras un
    // fallo no dispararía el change y parecería que el botón no hace nada.
    event.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      const payload = JSON.parse(await file.text())
      const res = await fetch('/api/account/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        toast.show({ message: t('importDataError'), type: 'error' })
        return
      }
      const result: { libraryImported: number; listsImported: number } = await res.json()
      toast.show({
        message: t('importDataSuccess', {
          count: result.libraryImported,
          lists: result.listsImported,
        }),
        type: 'success',
      })
      router.refresh()
    } catch {
      // Cubre tanto un JSON corrupto como un fallo de red.
      toast.show({ message: t('importDataError'), type: 'error' })
    } finally {
      setImporting(false)
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
      router.push(`/${currentLocale}/login`)
    } catch {
      toast.show({ message: t('deleteAccountError'), type: 'error' })
    } finally {
      setDeleting(false)
      setDeleteModalOpen(false)
    }
  }

  const eyebrow = 'text-[13px] font-extrabold uppercase tracking-wide text-text-tertiary mb-3'
  const row = 'px-5 py-4 sm:px-6 sm:py-5'

  return (
    <div className="flex flex-col gap-7">
      <PageHeading emoji="⚙️" className="mb-0">{t('title')}</PageHeading>

      {/* Sección Perfil */}
      <section>
        <p className={eyebrow}>{t('profile')}</p>
        <div className="flex flex-col rounded-20 bg-surface-default divide-y divide-surface-border overflow-hidden">
          {/* Email + cambio en línea */}
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

          {/* Username */}
          <div className={row}>
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
          </div>

          {/* Color de avatar */}
          <div className={cn(row, 'flex flex-col gap-3')}>
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

          {/* Personaje del avatar (E-AVATAR-ICONS) */}
          <div className={cn(row, 'flex flex-col gap-3')}>
            <label className="text-sm font-body text-text-secondary">{t('avatarIcon')}</label>
            <AvatarIconPicker
              value={avatarIcon}
              onChange={setAvatarIcon}
              label={t('avatarIcon')}
              noneLabel={t('avatarIconNone')}
            />
          </div>

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

      {/* Sección Preferencias */}
      <section>
        <p className={eyebrow}>{t('preferences')}</p>
        <div className="flex flex-col rounded-20 bg-surface-default overflow-hidden">
          {/* Idioma */}
          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <label className="text-sm font-semibold text-text-primary">{t('language')}</label>
            <div className="flex gap-2">
              {(['es', 'en'] as const).map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  className={cn(
                    'rounded-pill px-4 py-2 text-sm font-bold font-body transition-colors',
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
        </div>
      </section>

      {/* Sección Zona de peligro (D2/D3) */}
      <section>
        <p className={cn(eyebrow, 'text-accent-danger')}>{t('dangerZone')}</p>
        <div className="flex flex-col rounded-20 bg-surface-default divide-y divide-surface-border overflow-hidden">
          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <p className="text-sm font-body text-text-tertiary max-w-xs">{t('exportDataHint')}</p>
            <KButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0"
              onClick={handleExportData}
              loading={exporting}
            >
              {t('exportData')}
            </KButton>
          </div>

          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <p className="text-sm font-body text-text-tertiary max-w-xs">{t('importDataHint')}</p>
            {/* El input va oculto y lo dispara el botón: así el control mantiene
                el estilo de KButton (incluido su spinner) en vez del selector de
                archivo del navegador. */}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={handleImportData}
            />
            <KButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0"
              onClick={() => importInputRef.current?.click()}
              loading={importing}
            >
              {t('importData')}
            </KButton>
          </div>

          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <p className="text-sm font-body text-text-tertiary max-w-xs">{t('deleteAccountHint')}</p>
            <KButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0 border-2 border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10"
              onClick={() => setDeleteModalOpen(true)}
            >
              {t('deleteAccount')}
            </KButton>
          </div>
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
