import { useTranslations } from 'next-intl'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { KInput } from '@/components/ui/KInput'
import type { AccountSettings } from './shared'

type Props = { hasPassword: boolean } & Pick<
  AccountSettings,
  | 'deleteModalOpen'
  | 'setDeleteModalOpen'
  | 'deletionMessage'
  | 'deletionSummary'
  | 'handleDeleteAccount'
  | 'deleting'
  | 'deleteError'
  | 'deletePassword'
  | 'setDeletePassword'
>

/**
 * Confirmación del borrado de cuenta. Con contraseña la pide; sin ella (solo
 * Google), el servidor exige un inicio de sesión reciente.
 */
export function DeleteAccountModal({
  hasPassword,
  deleteModalOpen,
  setDeleteModalOpen,
  deletionMessage,
  deletionSummary,
  handleDeleteAccount,
  deleting,
  deleteError,
  deletePassword,
  setDeletePassword,
}: Props) {
  const t = useTranslations('settings')

  return (
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
      error={deleteError}
    >
      {hasPassword ? (
        <KInput
          type="password"
          autoComplete="current-password"
          label={t('deletePasswordLabel')}
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          disabled={deleting}
        />
      ) : null}
    </ConfirmModal>
  )
}
