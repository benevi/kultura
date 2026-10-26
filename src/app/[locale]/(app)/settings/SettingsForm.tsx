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
import { useRadioGroupKeys } from '@/components/ui/useRadioGroupKeys'
import type { AvatarColorName } from '@/lib/constants/avatarColors'
import { cn } from '@/lib/utils/index'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKeyFromError } from '@/lib/utils/auth-errors'
import {
  LIBRARY_VISIBILITIES,
  USERNAME_REGEX,
  isReservedUsername,
  purgeDate,
  type LibraryVisibility,
} from '@/app/api/settings/identity'
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
  /**
   * Quién ve la biblioteca (D-04b). `null` = la columna aún no existe o la
   * bandera LIBRARY_VISIBILITY está apagada: el selector no se enseña.
   */
  initialLibraryVisibility?: LibraryVisibility | null
  /** Borrado programado (ROJO-7): fecha ISO en que se pidió. */
  deletionRequestedAt?: string | null
  /**
   * Días de gracia del borrado (0 = inmediato: bandera ACCOUNT_GRACE apagada
   * o migración sin aplicar). El texto de ayuda dice lo que de verdad pasará.
   */
  graceDays?: number
  /**
   * F-25: «Mis plataformas» (se guarda sola, fuera del botón Guardar). La
   * página la pasa solo si la columna existe; va tras Preferencias.
   */
  platformsSlot?: React.ReactNode
}

/** Resumen de GET /api/account para el modal de borrado. */
interface DeletionSummary {
  library: number
  lists: number
  messages: number
  friends: number
  groups: Array<{ name: string; successor: string | null }> | null
  sharedLists: Array<{ name: string; successor: string | null }> | null
  graceDays: number
}

/**
 * Contacto para pedir lo que la exportación no incluye (mensajes recibidos),
 * el mismo que publica la política de privacidad. Cuando entre `LEGAL_CONTACT_EMAIL`
 * (src/app/.well-known/contact.ts, F-19) conviene importarlo de allí.
 */
const PRIVACY_CONTACT_EMAIL = 'kultura.app.contacto@gmail.com'

/** Cuántos grupos/listas se nombran en el modal antes de "y N más". */
const SUMMARY_MAX_NAMED = 4

function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function SettingsForm({
  initialUsername,
  initialAvatarColor,
  initialAvatarIcon,
  initialLocale,
  userEmail,
  isDemo = false,
  emailConfirmed = false,
  initialLibraryVisibility = null,
  deletionRequestedAt = null,
  graceDays = 0,
  platformsSlot = null,
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
  const [deletionSummary, setDeletionSummary] = useState<DeletionSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(deletionRequestedAt)
  const [cancellingDeletion, setCancellingDeletion] = useState(false)
  const [libraryVisibility, setLibraryVisibility] = useState<LibraryVisibility | null>(initialLibraryVisibility)
  // F-03: títulos del fichero que no se encontraron en el proveedor.
  const [importUnresolved, setImportUnresolved] = useState(0)

  // Cambio de email (R1 / art. 16 RGPD): formulario en línea.
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)
  const newEmailRef = useRef<HTMLInputElement>(null)
  // ACC-3: con un error, el foco vuelve al campo de usuario (su mensaje ya
  // va enlazado y con role="alert" desde KInput).
  const usernameRef = useRef<HTMLInputElement>(null)

  // ACC-10: color de avatar como radiogroup (una parada de Tab, flechas).
  const { getItemProps: getColorProps } = useRadioGroupKeys(
    AVATAR_COLORS.map((c) => c.name),
    avatarColor,
    setAvatarColor
  )

  function validateUsername(value: string): string {
    if (!USERNAME_REGEX.test(value)) return t('errorInvalidUsername')
    // El nombre que ya tiene no se revalida (puede ser anterior a la lista).
    if (value !== initialUsername && isReservedUsername(value)) return t('errorUsernameReserved')
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
      usernameRef.current?.focus()
      return
    }
    setUsernameError('')
    setSaving(true)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Solo si cambió: así un nombre antiguo nunca bloquea guardar el
          // resto (y no se gasta una escritura admin en cada guardado).
          ...(username !== initialUsername ? { username } : {}),
          avatar_color: avatarColor,
          preferred_locale: locale,
          ...(libraryVisibility !== null && libraryVisibility !== initialLibraryVisibility
            ? { library_visibility: libraryVisibility }
            : {}),
          // Solo se envía si el usuario lo tocó: mandar la columna cuando su
          // migración aún no está aplicada haría fallar TODO el guardado,
          // incluidos nombre e idioma.
          ...(avatarIcon !== initialAvatarIcon ? { avatar_icon: avatarIcon } : {}),
        }),
      })

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setUsernameError(
          data.error === 'username_reserved' ? t('errorUsernameReserved') : t('errorUsernameExists')
        )
        usernameRef.current?.focus()
        return
      }

      if (!res.ok) {
        toast.show({ message: t('errorSave'), type: 'error' })
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
      toast.show({ message: t('errorSave'), type: 'error' })
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
      const result: { libraryImported: number; listsImported: number; libraryUnresolved?: number } =
        await res.json()
      toast.show({
        message: t('importDataSuccess', {
          count: result.libraryImported,
          lists: result.listsImported,
        }),
        type: 'success',
      })
      setImportUnresolved(result.libraryUnresolved ?? 0)
      router.refresh()
    } catch {
      // Cubre tanto un JSON corrupto como un fallo de red.
      toast.show({ message: t('importDataError'), type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  /** Abre el modal y pide el resumen de lo que se perdería (ROJO-7). */
  async function openDeleteModal() {
    setDeleteModalOpen(true)
    setDeletionSummary(null)
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/account')
      if (res.ok) setDeletionSummary((await res.json()) as DeletionSummary)
    } catch {
      // Sin resumen se enseña el texto genérico: borrar sigue siendo posible.
    } finally {
      setSummaryLoading(false)
    }
  }

  /** "Se borrarán 34 títulos… Tu grupo «Club» pasará a lucia_lee…" */
  function deletionMessage(summary: DeletionSummary | null): string {
    if (!summary) return summaryLoading ? t('deleteSummaryLoading') : t('deleteAccountConfirmMessage')
    const parts = [
      t('deleteSummaryLoses', {
        library: summary.library,
        lists: summary.lists,
        messages: summary.messages,
        friends: summary.friends,
      }),
    ]
    const named = (items: Array<{ name: string; successor: string | null }>, moved: string, gone?: string) => {
      for (const item of items.slice(0, SUMMARY_MAX_NAMED)) {
        if (item.successor) parts.push(t(moved, { name: item.name, user: item.successor }))
        else if (gone) parts.push(t(gone, { name: item.name }))
      }
      if (items.length > SUMMARY_MAX_NAMED) {
        parts.push(t('deleteSummaryMore', { count: items.length - SUMMARY_MAX_NAMED }))
      }
    }
    named(summary.groups ?? [], 'deleteSummaryGroupMoves', 'deleteSummaryGroupGone')
    named(summary.sharedLists ?? [], 'deleteSummaryListMoves')
    parts.push(
      summary.graceDays > 0
        ? t('deleteSummaryGrace', { days: summary.graceDays })
        : t('deleteSummaryNow')
    )
    return parts.join(' ')
  }

  async function handleCancelDeletion() {
    setCancellingDeletion(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_deletion: true }),
      })
      if (!res.ok) {
        toast.show({ message: t('errorSave'), type: 'error' })
        return
      }
      setPendingDeletion(null)
      toast.show({ message: t('deletionCancelled'), type: 'success' })
      router.refresh()
    } catch {
      toast.show({ message: t('errorSave'), type: 'error' })
    } finally {
      setCancellingDeletion(false)
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
      const result = (await res.json().catch(() => ({}))) as { scheduled?: boolean; purgeAt?: string }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push(
        result.scheduled && result.purgeAt
          ? `/${currentLocale}/login?account=deletion_scheduled&purge_at=${encodeURIComponent(result.purgeAt)}`
          : `/${currentLocale}/login?account=deleted`
      )
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

      {/* ROJO-7: borrado programado; mientras no venza, se puede deshacer. */}
      {pendingDeletion && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-20 border-2 border-accent-danger/50 bg-surface-default px-5 py-4 sm:px-6"
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
      )}

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
              ref={usernameRef}
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

          {/* Color de avatar — ACC-2/ACC-10: grupo con nombre (antes un
              <label> huérfano), radios con flechas y nombres traducidos (antes
              "slate", "amber"…). */}
          <div className={cn(row, 'flex flex-col gap-3')}>
            <span id="avatar-color-label" className="text-sm font-body text-text-secondary">{t('avatarColor')}</span>
            <div role="radiogroup" aria-labelledby="avatar-color-label" className="grid grid-cols-8 gap-1">
              {AVATAR_COLORS.map((color, index) => (
                <button
                  key={color.name}
                  type="button"
                  {...getColorProps(color.name, index)}
                  aria-label={t(`avatarColors.${color.name}`)}
                  title={t(`avatarColors.${color.name}`)}
                  onClick={() => setAvatarColor(color.name)}
                  className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-8 w-8 rounded-full transition-transform group-hover:scale-110',
                      avatarColor === color.name
                        ? 'scale-110 ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default'
                        : ''
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Personaje del avatar (E-AVATAR-ICONS) — el propio selector es el
              radiogroup con nombre; aquí solo el rótulo visible. */}
          <div className={cn(row, 'flex flex-col gap-3')}>
            <span aria-hidden="true" className="text-sm font-body text-text-secondary">{t('avatarIcon')}</span>
            <AvatarIconPicker
              value={avatarIcon}
              onChange={setAvatarIcon}
              label={t('avatarIcon')}
              noneLabel={t('avatarIconNone')}
              iconLabel={(key) => t(`avatarIcons.${key}`)}
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
        </div>
      </section>

      {platformsSlot}

      {/* Privacidad (D-04b): quién ve la biblioteca. Sin la migración o con la
          bandera apagada, no se enseña y rige "cualquiera con cuenta". */}
      {libraryVisibility !== null && (
        <section>
          <p className={eyebrow}>{t('privacy')}</p>
          <div className={cn(row, 'flex flex-col gap-4 rounded-20 bg-surface-default')}>
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
                      'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[14px] bg-surface-elevated px-4 py-3 transition-colors',
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
      )}

      {/* Sección Zona de peligro (D2/D3) */}
      <section>
        <p className={cn(eyebrow, 'text-accent-danger')}>{t('dangerZone')}</p>
        <div className="flex flex-col rounded-20 bg-surface-default divide-y divide-surface-border overflow-hidden">
          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <p className="text-sm font-body text-text-tertiary max-w-xs">{t('exportDataHint', { email: PRIVACY_CONTACT_EMAIL })}</p>
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
            {/* Fuera del orden de Tab y del árbol accesible: lo maneja el
                botón visible (antes era una parada de Tab invisible). */}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
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
            {importUnresolved > 0 && (
              <p role="status" className="basis-full text-sm font-body text-text-secondary">
                {t('importUnresolved', { count: importUnresolved })}
              </p>
            )}
          </div>

          <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
            <p className="text-sm font-body text-text-tertiary max-w-xs">{graceDays > 0 ? t('deleteAccountHintGrace', { days: graceDays }) : t('deleteAccountHint')}</p>
            <KButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0 border-2 border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10"
              onClick={openDeleteModal}
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
        message={deletionMessage(deletionSummary)}
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
