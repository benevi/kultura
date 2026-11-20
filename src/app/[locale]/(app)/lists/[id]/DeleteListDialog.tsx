'use client'

import { useTranslations } from 'next-intl'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface DeleteListDialogProps {
  isOpen: boolean
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación de borrar la lista. */
export function DeleteListDialog({ isOpen, deleting, onConfirm, onCancel }: DeleteListDialogProps) {
  const t = useTranslations('lists')
  const tc = useTranslations('common')

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('deleteListTitle')}
      message={t('deleteListConfirm')}
      confirmLabel={tc('confirm')}
      cancelLabel={tc('cancel')}
      isDestructive
      loading={deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
