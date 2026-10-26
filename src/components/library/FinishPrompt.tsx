'use client'

// ============================================================
// KULTURA — «¿Lo has terminado?» (F-27)
// Al marcar el último episodio o capítulo (o la última página) se propone
// pasar el título a «Completado» y, si el diario de F-24 está activo,
// apuntarlo (marcado por defecto). «Todavía no» lo deja como está.
// ============================================================

import { useId, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { KButton } from '@/components/ui/KButton'

interface FinishPromptProps {
  open: boolean
  title: string
  mediaType: string
  /** El diario está activo: se ofrece apuntarlo. */
  diary: boolean
  loading?: boolean
  error?: string | null
  onConfirm: (log: boolean) => void
  onCancel: () => void
  finalFocusRef?: RefObject<HTMLElement | null>
}

export function FinishPrompt({
  open,
  title,
  mediaType,
  diary,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
  finalFocusRef,
}: FinishPromptProps) {
  const t = useTranslations('progress')
  const [log, setLog] = useState(true)
  const checkId = useId()

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('finishTitle', { title })}
      description={t('finishBody', { type: mediaType })}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
      showClose={false}
    >
      <div className="flex flex-col gap-4">
        {diary && (
          <label
            htmlFor={checkId}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-surface-default px-3 py-2.5"
          >
            <input
              id={checkId}
              type="checkbox"
              checked={log}
              onChange={(e) => setLog(e.target.checked)}
              className="accent-accent-positive h-5 w-5 flex-shrink-0"
            />
            <span className="text-sm font-medium text-text-primary">{t('finishLog')}</span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <KButton
            type="button"
            variant="primary"
            loading={loading}
            onClick={() => onConfirm(diary && log)}
            className="flex-1"
            data-autofocus
          >
            {t('finishConfirm', { type: mediaType })}
          </KButton>
          <KButton type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {t('finishCancel')}
          </KButton>
        </div>
      </div>
    </Modal>
  )
}
