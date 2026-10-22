'use client'

// ============================================================
// KULTURA — Botón de denuncia (D-13)
// Desplegable accesible: el disparador lleva aria-expanded/aria-controls, al
// abrir el foco va al primer motivo, Escape cierra y devuelve el foco al
// botón, los errores se anuncian (role="alert") y al terminar el foco pasa al
// mensaje de confirmación con el número de referencia (role="status").
// ============================================================

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import {
  ModerationRequestError,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/social/actions'

interface Props {
  targetType: ReportTargetType
  targetId: string
  /**
   * `button` (por defecto): botón con texto, para perfil, ficha y grupo.
   * `icon`: bandera de 44×44 para cada mensaje o post; el nombre accesible
   * dice qué se denuncia (`contextLabel`, p. ej. el autor).
   */
  variant?: 'button' | 'icon'
  contextLabel?: string
  className?: string
}

type Status = 'idle' | 'open' | 'sending' | 'sent'

const TRIGGER_KEY: Record<ReportTargetType, string> = {
  user: 'triggerUser',
  media: 'triggerMedia',
  message: 'triggerMessage',
  group_post: 'triggerPost',
  group: 'triggerGroup',
  list: 'triggerList',
}

/** Bandera rellena, mismo lenguaje que los iconos propios (formas chunky). */
function FlagIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={props.className}>
      <rect x="4" y="2.5" width="3" height="19" rx="1.5" />
      <path d="M7 4.5c3.5-2 6 1.5 11.5-.5 .8-.3 1.5.3 1.5 1.1v7.8c0 .5-.3.9-.8 1.1-5.2 2-7.7-1.5-12.2.5z" />
    </svg>
  )
}

/**
 * Devuelve el foco a un botón que vuelve a montarse (p. ej. tras cancelar una
 * confirmación que lo sustituía): `restore()` lo marca y, en cuanto el botón
 * está en el DOM, recibe el foco.
 */
export function useRestoreFocus<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T>(null)
  const pending = useRef(false)
  useEffect(() => {
    if (pending.current && ref.current) {
      pending.current = false
      ref.current.focus()
    }
  })
  return { ref, restore: () => { pending.current = true } }
}

interface InlineConfirmProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  error?: string | null
  className?: string
}

/**
 * Confirmación en línea (no modal) para las acciones de moderación: bloquear,
 * salir de un chat, borrar o expulsar. Al aparecer, el foco va a "Cancelar"
 * (la opción que no destruye nada); Escape cancela; el error se anuncia.
 * Quien la usa devuelve el foco a su botón al cancelar.
 */
export function InlineConfirm({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  error = null,
  className,
}: InlineConfirmProps) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
      className={`flex flex-col gap-2 p-3 w-full max-w-sm bg-surface-default border border-surface-border rounded-card text-sm text-left ${className ?? ''}`}
    >
      <p id={titleId} className="font-bold text-text-primary">{title}</p>
      <p id={bodyId} className="text-xs text-text-secondary">{body}</p>
      {error && <p role="alert" className="text-xs text-accent-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <KButton ref={cancelRef} type="button" variant="secondary" size="sm" className="text-xs" onClick={onCancel}>
          {cancelLabel}
        </KButton>
        <KButton
          type="button"
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={onConfirm}
          className="text-xs font-extrabold text-accent-danger border-accent-danger"
        >
          {confirmLabel}
        </KButton>
      </div>
    </div>
  )
}

export function ReportButton({ targetType, targetId, variant = 'button', contextLabel, className }: Props) {
  const t = useTranslations('report')
  const [status, setStatus] = useState<Status>('idle')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const panelId = useId()
  const titleId = useId()
  const detailsId = useId()
  const detailsHintId = useId()
  const errorId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const sentRef = useRef<HTMLParagraphElement>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (status === 'open') firstReasonRef.current?.focus()
    if (status === 'sent') sentRef.current?.focus()
    if (status === 'idle' && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus()
    }
  }, [status])

  function close() {
    restoreFocus.current = true
    setStatus('idle')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError(t('errorReason'))
      return
    }
    setStatus('sending')
    setError(null)
    try {
      const res = await submitReport({ targetType, targetId, reason, details: details.trim() || undefined })
      setReference(res.reference)
      setStatus('sent')
    } catch (err) {
      const code = err instanceof ModerationRequestError ? err.status : 0
      setError(code === 429 ? t('errorTooMany') : code === 404 ? t('errorNotFound') : t('error'))
      setStatus('open')
    }
  }

  const triggerLabel = contextLabel
    ? t('triggerWithContext', { target: t(TRIGGER_KEY[targetType]), context: contextLabel })
    : t(TRIGGER_KEY[targetType])

  if (status === 'sent') {
    return (
      <p
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="text-xs text-text-secondary px-2 py-1 rounded-button focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <span className="font-bold text-text-primary">{t('sent')}</span>{' '}
        {t('sentReference', { reference: reference ?? '' })}
      </p>
    )
  }

  const trigger =
    variant === 'icon' ? (
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={status !== 'idle'}
        aria-controls={status !== 'idle' ? panelId : undefined}
        onClick={() => (status === 'idle' ? setStatus('open') : close())}
        className="inline-flex items-center justify-center min-w-11 min-h-11 w-11 h-11 rounded-full text-text-tertiary hover:text-accent-danger hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <FlagIcon className="w-4 h-4" />
      </button>
    ) : (
      <KButton
        ref={triggerRef}
        variant="secondary"
        size="sm"
        aria-expanded={status !== 'idle'}
        aria-controls={status !== 'idle' ? panelId : undefined}
        aria-label={contextLabel ? triggerLabel : undefined}
        className="text-xs text-text-tertiary hover:text-accent-danger hover:border-accent-danger"
        onClick={() => (status === 'idle' ? setStatus('open') : close())}
      >
        <FlagIcon className="w-3.5 h-3.5" />
        {t('label')}
      </KButton>
    )

  return (
    <div className={className}>
      {trigger}
      {status !== 'idle' && (
        <form
          id={panelId}
          aria-labelledby={titleId}
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              close()
            }
          }}
          className="mt-2 flex flex-col gap-3 p-3 w-full max-w-sm bg-surface-default border border-surface-border rounded-card text-sm text-left"
        >
          <p id={titleId} className="font-bold text-text-primary text-sm">{t('prompt')}</p>
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">{t('reasonsLegend')}</legend>
            {REPORT_REASONS.map((r, i) => (
              <label key={r} className="flex items-center gap-2 min-h-11 px-1 rounded-button cursor-pointer text-text-primary hover:bg-surface-elevated">
                <input
                  ref={i === 0 ? firstReasonRef : undefined}
                  type="radio"
                  name={`${panelId}-reason`}
                  value={r}
                  checked={reason === r}
                  onChange={() => { setReason(r); setError(null) }}
                  className="w-4 h-4 accent-[var(--accent-pink)]"
                />
                <span className="text-sm">{t(`reasons.${r}`)}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor={detailsId} className="text-xs font-bold text-text-secondary">{t('detailsLabel')}</label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t('placeholder')}
              maxLength={REPORT_DETAILS_MAX}
              rows={3}
              aria-describedby={detailsHintId}
              className="w-full bg-surface-base border border-surface-border rounded-button px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
            />
            <p id={detailsHintId} className="text-xs text-text-tertiary">{t('detailsHint')}</p>
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-xs text-accent-danger">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <KButton type="button" variant="secondary" size="sm" className="text-xs" onClick={close}>
              {t('cancel')}
            </KButton>
            <KButton
              type="submit"
              variant="primary"
              size="sm"
              className="text-xs"
              loading={status === 'sending'}
              aria-describedby={error ? errorId : undefined}
            >
              {t('submit')}
            </KButton>
          </div>
        </form>
      )}
    </div>
  )
}
