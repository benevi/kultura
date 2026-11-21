'use client'

import { PageHeading } from '@/components/layout/PageHeading'
import { IconSettings } from '@/components/icons'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import type { RatingScale } from '@/types/library'
import type { LibraryVisibility } from '@/lib/account/identity'
import { useAccountSettings } from '@/hooks/useAccountSettings'
import { PendingDeletionBanner } from './_components/PendingDeletionBanner'
import { ProfileSection } from './_components/ProfileSection'
import { PreferencesSection } from './_components/PreferencesSection'
import { WeeklyEmailSection } from './_components/WeeklyEmailSection'
import { PushSection } from './_components/PushSection'
import { PrivacySection } from './_components/PrivacySection'
import { DangerZoneSection } from './_components/DangerZoneSection'
import { DeleteAccountModal } from './_components/DeleteAccountModal'

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
   * Quién ve la biblioteca (D-04b). `null` = sin un valor válido en la
   * columna: el selector no se enseña.
   */
  initialLibraryVisibility?: LibraryVisibility | null
  /** Borrado programado (ROJO-7): fecha ISO en que se pidió. */
  deletionRequestedAt?: string | null
  /**
   * Días de gracia del borrado (0 = migración sin aplicar). El texto de ayuda
   * dice lo que de verdad pasará.
   */
  graceDays?: number
  /**
   * La cuenta entra con contraseña: el borrado la pide. Sin ella (solo
   * Google), el servidor exige un inicio de sesión reciente.
   */
  hasPassword?: boolean
  /**
   * F-25: «Mis plataformas» (se guarda sola, fuera del botón Guardar). La
   * página la pasa solo si la columna existe; va tras Preferencias.
   */
  platformsSlot?: React.ReactNode
  /**
   * F-24 → F-28: escala de notas (½★ o /10), antes en la Biblioteca. `null`:
   * no se enseña.
   */
  initialRatingScale?: RatingScale | null
  /**
   * F-28: correo semanal opt-in. `null` = no disponible (bandera WEEKLY_EMAIL
   * o claves sin poner, migración sin aplicar, cuenta demo): no se enseña.
   */
  initialWeeklyEmail?: { weekly: boolean; consentedAt: string | null; pending?: boolean } | null
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
  hasPassword = true,
  platformsSlot = null,
  initialRatingScale = null,
  initialWeeklyEmail = null,
}: SettingsFormProps) {
  const t = useTranslations('settings')
  // La lógica vive en `src/hooks/useAccountSettings.ts` (rescate F0); cada
  // sección de `_components/` solo pinta lo suyo.
  const settings = useAccountSettings({
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
  const { pendingDeletion, weeklyEmail, push, libraryVisibility, saving } = settings

  return (
    <div className="flex flex-col gap-7">
      <PageHeading icon={IconSettings} className="mb-0">{t('title')}</PageHeading>

      {pendingDeletion && (
        <PendingDeletionBanner
          pendingDeletion={pendingDeletion}
          handleCancelDeletion={settings.handleCancelDeletion}
          cancellingDeletion={settings.cancellingDeletion}
        />
      )}

      <ProfileSection userEmail={userEmail} isDemo={isDemo} emailConfirmed={emailConfirmed} settings={settings} />

      <PreferencesSection
        locale={settings.locale}
        setLocale={settings.setLocale}
        ratingScale={settings.ratingScale}
        scaleState={settings.scaleState}
        handleRatingScale={settings.handleRatingScale}
      />

      {/* F-25: «Mis plataformas», tras Preferencias. */}
      {platformsSlot}

      {weeklyEmail !== null && (
        <WeeklyEmailSection
          isDemo={isDemo}
          weeklyEmail={weeklyEmail}
          weeklyState={settings.weeklyState}
          handleWeeklyEmail={settings.handleWeeklyEmail}
        />
      )}

      {/* Sin PUSH_ENABLED, sin claves o sin la migración, push queda oculto. */}
      {push.state !== 'hidden' && push.state !== 'loading' && <PushSection isDemo={isDemo} push={push} />}

      {/* Sin la migración o con la bandera apagada, sin selector de privacidad. */}
      {libraryVisibility !== null && (
        <PrivacySection libraryVisibility={libraryVisibility} setLibraryVisibility={settings.setLibraryVisibility} />
      )}

      <DangerZoneSection
        graceDays={graceDays}
        exporting={settings.exporting}
        handleExportData={settings.handleExportData}
        importing={settings.importing}
        importInputRef={settings.importInputRef}
        handleImportData={settings.handleImportData}
        importUnresolved={settings.importUnresolved}
        openDeleteModal={settings.openDeleteModal}
      />

      {/* Botón guardar */}
      <KButton onClick={settings.handleSave} loading={saving} className="w-full sm:w-fit">
        {saving ? t('saving') : t('save')}
      </KButton>

      <DeleteAccountModal
        hasPassword={hasPassword}
        deleteModalOpen={settings.deleteModalOpen}
        setDeleteModalOpen={settings.setDeleteModalOpen}
        deletionMessage={settings.deletionMessage}
        deletionSummary={settings.deletionSummary}
        handleDeleteAccount={settings.handleDeleteAccount}
        deleting={settings.deleting}
        deleteError={settings.deleteError}
        deletePassword={settings.deletePassword}
        setDeletePassword={settings.setDeletePassword}
      />
    </div>
  )
}
