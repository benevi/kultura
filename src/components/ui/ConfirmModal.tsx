'use client'

import type { RefObject } from 'react'
import { KButton } from '@/components/ui/KButton'
import { Modal } from '@/components/ui/Modal'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Si true, el botón de confirmar se muestra en rojo (acción destructiva). */
  isDestructive?: boolean
  /** Estado de carga: deshabilita y muestra spinner en el botón de confirmar. */
  loading?: boolean
  /** Dónde vuelve el foco si el botón que lo abrió desaparece al confirmar. */
  finalFocusRef?: RefObject<HTMLElement>
  /** Error al confirmar: se anuncia dentro del diálogo. */
  error?: string | null
}

/**
 * Confirmación sobre `Modal` (ACC-1): `alertdialog` con el título y el mensaje
 * enlazados (el lector lee las dos cosas al abrir), foco inicial en el botón
 * de cancelar —lo seguro en una acción destructiva—, Esc y fondo cierran
 * salvo mientras se confirma, y el foco vuelve al botón que lo abrió.
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDestructive = false,
  loading = false,
  finalFocusRef,
  error = null,
}: ConfirmModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title={title}
      description={message}
      role="alertdialog"
      // Sin ×: duplicaba "Cancelar", que ya está a la vista y es el foco inicial.
      showClose={false}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
    >
      <div className="flex flex-wrap justify-end gap-2">
        <KButton
          variant="secondary"
          size="md"
          onClick={onCancel}
          disabled={loading}
          data-autofocus
        >
          {cancelLabel}
        </KButton>
        <KButton
          variant="primary"
          size="md"
          loading={loading}
          onClick={onConfirm}
          className={
            isDestructive
              ? // ACC-4: rojo más oscuro + su texto claro = 4,94:1. El rojo base
                // con el texto oscuro de "positivo" daba 4,28:1.
                'bg-accent-danger-solid text-on-accent-danger hover:brightness-110'
              : undefined
          }
        >
          {confirmLabel}
        </KButton>
      </div>
    </Modal>
  )
}
