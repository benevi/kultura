'use client'

// ============================================================
// KULTURA — SalaReportDialog (fase 8.5, F2d, ficha con `SALA_FICHA`)
// «Denunciar» en «Sala»: en la ficha de hoy es un desplegable en línea; aquí
// es un `SalaDialog` (hoja en móvil) con el mismo formulario. El estado y el
// envío siguen en `ReportButton`: aquí solo se pinta.
//
// - El motivo es un `SalaRadioGroup` obligatorio; si falta, el error lo lleva
//   el grupo y el foco va al primer motivo.
// - El error del envío (servidor, demasiadas, ya no existe) va dentro del
//   diálogo (`error`), anunciado.
// - Al enviarse se cierra y el foco va a la confirmación con la referencia,
//   que sustituye al botón (`finalFocusRef`).
//
// Llega por next/dynamic (`SalaSocialDialogsLazy`): la ficha de hoy no lo
// descarga.
// ============================================================

import { useEffect, useId, useRef, type FormEvent, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { SalaDialog } from '@/components/sala/SalaDialog'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaRadio, SalaRadioGroup } from '@/components/sala/SalaRadioGroup'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason } from '@/lib/social/actions'
import { useWorkPalette } from './useWorkPalette'

export interface SalaReportDialogProps {
  open: boolean
  onClose: () => void
  /** El botón que lo abre: de su obra sale la paleta. */
  anchorRef?: RefObject<HTMLElement | null>
  /** A dónde va el foco si el botón ya no está al cerrar (la confirmación). */
  finalFocusRef?: RefObject<HTMLElement | null>
  /** Qué se denuncia («Denunciar título»): nombra al diálogo. */
  title: string
  /**
   * El nombre del botón de cerrar (`common.close`), ya traducido. Llega de
   * fuera: `ReportButton` también se pinta en el perfil público, que no carga
   * `common` (REN-5). Sin él no hay botón de cerrar: cierran Escape y «Cancelar».
   */
  closeLabel?: string
  reason: ReportReason | null
  onReason: (reason: ReportReason) => void
  details: string
  onDetails: (details: string) => void
  /** Falta el motivo: lo dice el grupo de motivos. */
  reasonError?: string
  /** El envío ha fallado: lo dice el diálogo. */
  error: string | null
  sending: boolean
  onSubmit: (e: FormEvent) => void
}

export function SalaReportDialog({
  open,
  onClose,
  anchorRef,
  finalFocusRef,
  title,
  closeLabel,
  reason,
  onReason,
  details,
  onDetails,
  reasonError,
  error,
  sending,
  onSubmit,
}: SalaReportDialogProps) {
  const t = useTranslations('report')
  const palette = useWorkPalette(anchorRef, open)
  const formId = useId()
  const firstReasonRef = useRef<HTMLInputElement>(null)

  // Sin motivo, el foco va al primero: el grupo dice qué falta.
  useEffect(() => {
    if (reasonError) firstReasonRef.current?.focus()
  }, [reasonError])

  return (
    <SalaDialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={title}
      {...(closeLabel ? { closeLabel } : { showClose: false as const })}
      dismissible={!sending}
      finalFocusRef={finalFocusRef}
      error={error}
      palette={palette}
      footer={
        <>
          <SalaButton variant="quiet" onClick={onClose} disabled={sending}>
            {t('cancel')}
          </SalaButton>
          <SalaButton type="submit" form={formId} variant="primary" loading={sending} loadingLabel={t('submit')}>
            {t('submit')}
          </SalaButton>
        </>
      }
    >
      {/* `noValidate`: el motivo que falta lo dice el grupo, no el globo del navegador. */}
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <SalaRadioGroup
          legend={t('prompt')}
          name={`${formId}-reason`}
          value={reason ?? ''}
          onChange={(value) => onReason(value as ReportReason)}
          required
          error={reasonError}
        >
          {REPORT_REASONS.map((r, i) => (
            <SalaRadio key={r} ref={i === 0 ? firstReasonRef : undefined} value={r} label={t(`reasons.${r}`)} />
          ))}
        </SalaRadioGroup>
        <SalaTextarea
          label={t('detailsLabel')}
          hint={t('detailsHint')}
          value={details}
          onChange={(e) => onDetails(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={REPORT_DETAILS_MAX}
          rows={3}
          className="resize-none"
        />
      </form>
    </SalaDialog>
  )
}
