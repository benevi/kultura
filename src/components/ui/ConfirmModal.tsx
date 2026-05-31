'use client'

import { KButton } from '@/components/ui/KButton'

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
}

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
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div
      data-testid="modal-overlay"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-backdrop-in"
    >
      <div
        data-testid="modal-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-elevated border border-surface-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5 animate-modal-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text-primary">{title}</h2>
          <button
            onClick={onCancel}
            aria-label={cancelLabel}
            className="text-text-secondary hover:text-text-primary text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-text-secondary">{message}</p>

        <div className="flex gap-2 justify-end">
          <KButton variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </KButton>
          <KButton
            variant="primary"
            size="sm"
            loading={loading}
            onClick={onConfirm}
            className={
              isDestructive
                ? 'bg-accent-danger text-on-accent-positive hover:brightness-110'
                : undefined
            }
          >
            {confirmLabel}
          </KButton>
        </div>
      </div>
    </div>
  )
}
