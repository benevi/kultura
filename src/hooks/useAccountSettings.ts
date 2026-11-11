import { useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useToastContext } from '@/components/ui/ToastProvider'
import { isValidAvatarColor } from '@/lib/constants/avatarColors'
import { saveRatingScale } from '@/lib/library/actions'
import { WEEKLY_EMAIL_CONSENT_VERSION } from '@/lib/email/consent'
import { unsubscribeCurrentDevice, usePushSettings } from '@/lib/push/client'
import { isRatingScale, type RatingScale } from '@/types/library'
import type { AvatarColorName } from '@/lib/constants/avatarColors'
import { createClient } from '@/lib/supabase/client'
import { getAuthErrorKeyFromError } from '@/lib/utils/auth-errors'
import { USERNAME_REGEX, isReservedUsername, type LibraryVisibility } from '@/lib/account/identity'
import { ApiError } from '@/lib/api/client'
import { ACCOUNT_ERRORS } from '@/lib/account/errors'
import { updateSettings } from '@/lib/settings/client'
import { SETTINGS_ERRORS } from '@/lib/settings/errors'
import {
  cancelAccountDeletion,
  deleteAccount,
  fetchDeletionSummary,
  importKulturaExport,
  type DeletionSummary,
} from '@/lib/account/client'

// KULTURA — Lógica de Ajustes de cuenta (rescate F0, §7.3).
//
// Sacada tal cual de `app/[locale]/(app)/settings/SettingsForm.tsx` para que la
// UI v2 la reutilice: identidad (nombre, color, personaje, idioma, quién ve la
// biblioteca), escala de notas, correo semanal, cambio de correo, exportar e
// importar, borrado de cuenta y avisos push. El componente solo pinta.

/** Valores iniciales de Ajustes (los mismos que recibe `SettingsForm`). */
export interface AccountSettingsInit {
  initialUsername: string
  initialAvatarColor: string
  initialAvatarIcon: string | null
  initialLocale: string | null
  userEmail: string
  isDemo: boolean
  initialLibraryVisibility: LibraryVisibility | null
  deletionRequestedAt: string | null
  initialRatingScale: RatingScale | null
  initialWeeklyEmail: { weekly: boolean; consentedAt: string | null; pending?: boolean } | null
}

/** Resumen de GET /api/account para el modal de borrado. */
export type { DeletionSummary }

/** Cuántos grupos/listas se nombran en el modal antes de "y N más". */
const SUMMARY_MAX_NAMED = 4

export function useAccountSettings({
  initialUsername,
  initialAvatarColor,
  initialAvatarIcon,
  initialLocale,
  userEmail,
  isDemo,
  initialLibraryVisibility,
  deletionRequestedAt,
  initialRatingScale,
  initialWeeklyEmail,
}: AccountSettingsInit) {
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
  /** Contraseña para reautenticar el borrado (solo cuentas con contraseña). */
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletionSummary, setDeletionSummary] = useState<DeletionSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(deletionRequestedAt)
  const [cancellingDeletion, setCancellingDeletion] = useState(false)
  const [libraryVisibility, setLibraryVisibility] = useState<LibraryVisibility | null>(initialLibraryVisibility)
  // F-03: títulos del fichero que no se encontraron en el proveedor.
  const [importUnresolved, setImportUnresolved] = useState(0)
  // F-28: escala de notas y correo semanal, que se guardan solos (sin el botón Guardar).
  const [ratingScale, setRatingScale] = useState<RatingScale | null>(initialRatingScale)
  const [scaleState, setScaleState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // F-33: avisos push de ESTE navegador (el permiso solo se pide al pulsar).
  const push = usePushSettings(currentLocale, { disabled: isDemo })
  const [weeklyEmail, setWeeklyEmail] = useState(initialWeeklyEmail)
  const [weeklyState, setWeeklyState] = useState<
    'idle' | 'saving' | 'on' | 'off' | 'pending' | 'cooldown' | 'dailyLimit' | 'busy' | 'unconfirmed' | 'sendFailed' | 'error' | 'stale'
  >(initialWeeklyEmail?.pending && !initialWeeklyEmail.weekly ? 'pending' : 'idle')

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
      await updateSettings({
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
      })

      toast.show({ message: t('saved'), type: 'success' })

      // El header lo pinta el layout en el SERVIDOR: sin refrescarlo, el avatar
      // seguía mostrando las iniciales viejas hasta recargar a mano.
      router.refresh()

      if (locale !== currentLocale) {
        const newPath = pathname.replace(`/${currentLocale}/`, `/${locale}/`)
        router.push(newPath)
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setUsernameError(
          err.message === SETTINGS_ERRORS.usernameReserved ? t('errorUsernameReserved') : t('errorUsernameExists')
        )
        usernameRef.current?.focus()
      } else {
        toast.show({ message: t('errorSave'), type: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRatingScale(next: string) {
    if (!isRatingScale(next) || next === ratingScale) return
    const previous = ratingScale
    setRatingScale(next)
    setScaleState('saving')
    try {
      await saveRatingScale(next)
      setScaleState('saved')
      // La escala se lee en el servidor (Biblioteca, diario): que no quede vieja en la caché del router.
      router.refresh()
    } catch {
      setRatingScale(previous)
      setScaleState('error')
    }
  }

  // Doble opt-in: activar solo PIDE el correo de confirmación (202); el
  // interruptor sigue apagado hasta que se pulsa el enlace de ese correo.
  async function handleWeeklyEmail(enabled: boolean) {
    if (!weeklyEmail || isDemo) return
    const previous = weeklyEmail
    if (!enabled) setWeeklyEmail({ ...weeklyEmail, weekly: false })
    setWeeklyState('saving')
    try {
      const res = await fetch('/api/email/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly: enabled, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION, locale: currentLocale }),
      })
      if (res.status === 202) {
        setWeeklyEmail({ ...previous, weekly: false, pending: true })
        setWeeklyState('pending')
        return
      }
      if (!res.ok) {
        const code = ((await res.json().catch(() => ({}))) as { error?: string }).error
        setWeeklyEmail(previous)
        setWeeklyState(
          res.status === 409
            ? 'stale'
            : code === 'cooldown'
              ? 'cooldown'
              : code === 'daily_limit'
                ? 'dailyLimit'
                : code === 'busy'
                  ? 'busy'
                  : code === 'unconfirmed_email'
                ? 'unconfirmed'
                : code === 'send_failed'
                  ? 'sendFailed'
                  : 'error'
        )
        return
      }
      const data = (await res.json()) as { weekly?: boolean; consentedAt?: string | null }
      setWeeklyEmail({ weekly: data.weekly === true, consentedAt: data.consentedAt ?? null, pending: false })
      setWeeklyState(data.weekly ? 'on' : 'off')
    } catch {
      setWeeklyEmail(previous)
      setWeeklyState('error')
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
      const result = await importKulturaExport(payload)
      toast.show({
        message: t('importDataSuccess', {
          count: result.libraryImported,
          lists: result.listsImported,
        }),
        type: 'success',
      })
      setImportUnresolved(result.libraryUnresolved)
      // Saneamiento 1.4: lo que la base no guardó se dice (antes se daba por
      // importado). Reimportar el mismo archivo lo reintenta sin duplicar.
      const failed = result.libraryFailed + result.listItemsFailed + result.diaryFailed
      if (failed > 0 || (result.sectionsFailed?.length ?? 0) > 0) {
        toast.show({ message: t('importPartial', { count: failed }), type: 'error' })
      }
      router.refresh()
    } catch {
      // Cubre un JSON corrupto, un fichero que no es nuestro y un fallo de red.
      toast.show({ message: t('importDataError'), type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  /** Abre el modal y pide el resumen de lo que se perdería (ROJO-7). */
  async function openDeleteModal() {
    setDeleteModalOpen(true)
    setDeletePassword('')
    setDeleteError(null)
    setDeletionSummary(null)
    setSummaryLoading(true)
    try {
      setDeletionSummary(await fetchDeletionSummary())
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
      await cancelAccountDeletion()
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
    setDeleteError(null)
    try {
      let result: Awaited<ReturnType<typeof deleteAccount>>
      try {
        result = await deleteAccount(deletePassword)
      } catch (err) {
        // Reautenticación: el error se queda en el modal, abierto, para corregir.
        const reason = err instanceof ApiError ? err.message : null
        if (reason === ACCOUNT_ERRORS.passwordRequired || reason === ACCOUNT_ERRORS.wrongPassword) {
          setDeleteError(t('deletePasswordWrong'))
        } else if (reason === ACCOUNT_ERRORS.reauthRequired) {
          setDeleteError(t('deleteReauthRequired'))
        } else {
          setDeleteError(t('deleteAccountError'))
        }
        return
      }
      setDeleteModalOpen(false)
      const supabase = createClient()
      await unsubscribeCurrentDevice()
      await supabase.auth.signOut()
      router.push(
        result.scheduled
          ? `/${currentLocale}/login?account=deletion_scheduled&purge_at=${encodeURIComponent(result.purgeAt)}`
          : `/${currentLocale}/login?account=deleted`
      )
    } catch {
      setDeleteError(t('deleteAccountError'))
    } finally {
      setDeleting(false)
      setDeletePassword('')
    }
  }

  return {
    username,
    avatarColor,
    setAvatarColor,
    avatarIcon,
    setAvatarIcon,
    locale,
    setLocale,
    saving,
    usernameError,
    exporting,
    importing,
    deleteModalOpen,
    setDeleteModalOpen,
    deleting,
    deletionSummary,
    pendingDeletion,
    cancellingDeletion,
    libraryVisibility,
    setLibraryVisibility,
    importUnresolved,
    ratingScale,
    scaleState,
    weeklyEmail,
    weeklyState,
    emailFormOpen,
    setEmailFormOpen,
    newEmail,
    setNewEmail,
    emailError,
    setEmailError,
    emailSending,
    emailSentTo,
    setEmailSentTo,
    importInputRef,
    push,
    newEmailRef,
    usernameRef,
    handleUsernameChange,
    handleSave,
    handleRatingScale,
    handleWeeklyEmail,
    handleChangeEmail,
    handleExportData,
    handleImportData,
    openDeleteModal,
    deletionMessage,
    handleCancelDeletion,
    handleDeleteAccount,
    deletePassword,
    setDeletePassword,
    deleteError,
  }
}
