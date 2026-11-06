'use client'

import { PageHeading } from '@/components/layout/PageHeading'
import { IconSettings } from '@/components/icons'
import { useTranslations, useLocale } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AVATAR_COLORS } from '@/lib/constants/avatarColors'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { useRadioGroupKeys } from '@/components/ui/useRadioGroupKeys'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { RatingScale } from '@/types/library'
import { cn } from '@/lib/utils/index'
import { LIBRARY_VISIBILITIES, purgeDate, type LibraryVisibility } from '@/lib/account/identity'
import { useAccountSettings } from '@/hooks/useAccountSettings'
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
  /**
   * F-24 → F-28: escala de notas (½★ o /10), antes en la Biblioteca. `null`
   * sin RATING_SCALE_10 (la escala aún no se usa en la app): no se enseña.
   */
  initialRatingScale?: RatingScale | null
  /**
   * F-28: correo semanal opt-in. `null` = no disponible (bandera WEEKLY_EMAIL
   * o claves sin poner, migración sin aplicar, cuenta demo): no se enseña.
   */
  initialWeeklyEmail?: { weekly: boolean; consentedAt: string | null; pending?: boolean } | null
}

/**
 * Contacto para pedir lo que la exportación no incluye (mensajes recibidos),
 * el mismo que publica la política de privacidad. Cuando entre `LEGAL_CONTACT_EMAIL`
 * (src/app/.well-known/contact.ts, F-19) conviene importarlo de allí.
 */
const PRIVACY_CONTACT_EMAIL = 'kultura.app.contacto@gmail.com'

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
  initialRatingScale = null,
  initialWeeklyEmail = null,
}: SettingsFormProps) {
  const t = useTranslations('settings')
  const tPush = useTranslations('push.settings')
  const currentLocale = useLocale()
  // La lógica vive en `src/hooks/useAccountSettings.ts` (rescate F0).
  const {
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
  } = useAccountSettings({
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
  })

  // ACC-10: color de avatar como radiogroup (una parada de Tab, flechas).
  const { getItemProps: getColorProps } = useRadioGroupKeys(
    AVATAR_COLORS.map((c) => c.name),
    avatarColor,
    setAvatarColor
  )

  const eyebrow = 'text-meta font-extrabold uppercase tracking-wide text-text-tertiary mb-3'
  const row = 'px-5 py-4 sm:px-6 sm:py-5'

  return (
    <div className="flex flex-col gap-7">
      <PageHeading icon={IconSettings} className="mb-0">{t('title')}</PageHeading>

      {/* ROJO-7: borrado programado; mientras no venza, se puede deshacer. */}
      {pendingDeletion && (
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
      )}

      {/* Sección Perfil */}
      <section>
        <p className={eyebrow}>{t('profile')}</p>
        <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
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
        <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
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

          {/* F-28: escala de notas (antes en la Biblioteca); se guarda sola. */}
          {ratingScale !== null && (
            <div className={cn(row, 'flex flex-col gap-3')}>
              <div className="flex flex-col gap-1">
                <span id="settings-rating-scale-label" className="text-sm font-semibold text-text-primary">
                  {t('ratingScale')}
                </span>
                <span className="text-sm font-body text-text-tertiary">{t('ratingScaleHint')}</span>
              </div>
              <SegmentedControl
                ariaLabel={t('ratingScale')}
                value={ratingScale}
                onChange={handleRatingScale}
                options={[
                  { value: 'stars', label: t('ratingScaleStars') },
                  { value: 'ten', label: t('ratingScaleTen') },
                ]}
              />
              <p role="status" className="min-h-5 text-meta text-text-tertiary">
                {scaleState === 'saved' ? t('ratingScaleSaved') : ''}
              </p>
              {scaleState === 'error' && (
                <p role="alert" className="text-sm text-accent-danger">{t('ratingScaleError')}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {platformsSlot}

      {/* F-28 (CRE-9): correo semanal, opt-in con doble confirmación por
          correo y el texto que se acepta a la vista; la base registra versión
          y fecha al confirmar. */}
      {weeklyEmail !== null && (
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
      )}

      {/* F-33 (MOV-10): notificaciones push de este dispositivo. Sin
          PUSH_ENABLED, sin claves o sin la migración no se enseña. El permiso
          del navegador se pide al pulsar el interruptor, nunca al cargar. */}
      {push.state !== 'hidden' && push.state !== 'loading' && (
        <section id="push" className="scroll-mt-20">
          <p className={eyebrow}>{tPush('section')}</p>
          <div className={cn(row, 'flex flex-col gap-3 rounded-bento bg-surface-default')}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="push-switch" className="cursor-pointer text-sm font-semibold text-text-primary">
                  {tPush('label')}
                </label>
                <p id="push-description" className="text-sm font-body text-text-tertiary">
                  {tPush('description')}
                </p>
              </div>
              <input
                id="push-switch"
                type="checkbox"
                role="switch"
                checked={push.state === 'on'}
                aria-describedby="push-description"
                disabled={isDemo || !['on', 'off', 'saving'].includes(push.state)}
                // Mientras se guarda, aria-disabled (no disabled): el foco se queda en el interruptor.
                aria-disabled={push.state === 'saving' || undefined}
                onChange={(e) => {
                  if (push.state === 'saving') return
                  void (e.target.checked ? push.enable() : push.disable())
                }}
                className="mt-0.5 h-6 w-6 flex-shrink-0 cursor-pointer accent-accent-pink disabled:cursor-not-allowed aria-disabled:cursor-wait"
              />
            </div>
            {isDemo ? (
              <p className="text-sm text-text-tertiary">{tPush('demo')}</p>
            ) : push.state === 'unsupported' || push.state === 'ios_install' || push.state === 'denied' ? (
              <p className="text-sm text-text-tertiary">
                {push.state === 'unsupported'
                  ? tPush('unsupported')
                  : push.state === 'ios_install'
                    ? tPush('iosInstall')
                    : tPush('denied')}
              </p>
            ) : null}
            <p role="status" className="min-h-5 text-xs text-text-tertiary">
              {push.state === 'saving'
                ? tPush('saving')
                : push.notice === 'allOff'
                  ? tPush('allOff')
                  : push.notice === 'dismissed'
                    ? tPush('dismissed')
                    : push.state === 'on'
                      ? tPush('on')
                      : push.state === 'off'
                        ? tPush('off')
                        : ''}
            </p>
            {push.notice === 'error' && (
              <p role="alert" className="text-sm text-accent-danger">
                {tPush('error')}
              </p>
            )}
            {!isDemo && push.otherDevices > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-text-tertiary">{tPush('otherDevices', { count: push.otherDevices })}</p>
                <KButton
                  variant="secondary"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => {
                    if (push.state !== 'saving') void push.disable(true)
                  }}
                  aria-disabled={push.state === 'saving' || undefined}
                >
                  {tPush('disableAll')}
                </KButton>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Privacidad (D-04b): quién ve la biblioteca. Sin la migración o con la
          bandera apagada, no se enseña y rige "cualquiera con cuenta". */}
      {libraryVisibility !== null && (
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
      )}

      {/* Sección Zona de peligro (D2/D3) */}
      <section>
        <p className={cn(eyebrow, 'text-accent-danger')}>{t('dangerZone')}</p>
        <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
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
