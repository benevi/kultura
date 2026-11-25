'use client'

// ============================================================
// KULTURA — Progreso con «1 toque» en Inicio, en «Sala» (fase 8.5 I2a)
// Lo mismo que `ContinueProgress` (F-27) con las piezas de «Sala»: el texto
// («Cap. 34»), la barra, el «+1» con `SalaButton` (48 px) y, al marcar lo
// último, «¿Has terminado…?» en `SalaConfirmDialog` (Cancelar primero, como
// en todos los diálogos de «Sala»; el foco empieza en él). La lógica es la de
// siempre (`useProgressAdvance`): optimista, con vuelta atrás y aviso si falla.
//
// Todo con hueco fijo: el botón, la barra y el hueco del aviso existen desde
// el primer pintado (vienen del servidor), así que nada se mueve (CLS 0).
// ============================================================

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaConfirmDialog } from '@/components/sala/SalaConfirmDialog'
import { SalaCheckbox } from '@/components/sala/SalaCheckbox'
import { useProgressAdvance } from '@/components/library/useProgressAdvance'
import { useProgressLabel } from '@/components/library/useProgressLabel'
import { playStamp } from '@/lib/library/motion'
import { progressPercent, quickUnit, type ProgressValue } from '@/lib/library/progress'
import type { LibraryStatus } from '@/types/library'

export interface SalaHomeProgressProps {
  mediaId: string
  mediaType: string
  title: string
  progress: ProgressValue | null
  status: LibraryStatus
  variant: 'hero' | 'card'
}

export function SalaHomeProgress({ mediaId, mediaType, title, progress: initial, status: initialStatus, variant }: SalaHomeProgressProps) {
  const t = useTranslations('progress')
  const td = useTranslations('diary')
  const tl = useTranslations('library')
  const label = useProgressLabel()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const stampRef = useRef<HTMLSpanElement>(null)
  const descId = useId()
  const state = useProgressAdvance({ mediaId, mediaType, title, progress: initial, status: initialStatus })
  const { progress, status } = state
  // «Apuntarlo en el diario», marcado por defecto (como en `FinishPrompt`).
  const [log, setLog] = useState(true)

  const done = status === 'completed'
  const percent = progressPercent(mediaType, progress)
  const unit = quickUnit(mediaType, progress)
  const hero = variant === 'hero'
  const diary = state.finish?.diary ?? false

  useEffect(() => {
    if (!done) return
    playStamp(stampRef.current)
    // El «+1» ya no está: si el foco se ha quedado sin sitio (estaba en él o
    // volvía a él al cerrar el diálogo), pasa al sello que lo sustituye.
    if (!document.activeElement || document.activeElement === document.body) stampRef.current?.focus()
  }, [done])

  return (
    <div data-sala-home-progress={variant} className={cn('flex flex-col text-sala-ink', hero ? 'w-full max-w-sm gap-2' : 'mt-2 gap-1.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate tabular-nums sala-type-small" data-testid="progress-label">
          {done ? tl('status.completed') : label(mediaType, progress)}
        </span>
        {/* En % la etiqueta ya dice el porcentaje: no se repite. */}
        {percent !== null && !done && unit !== 'percent' ? (
          <span className="tabular-nums text-sala-ink-secondary sala-type-small">{t('percentDone', { percent })}</span>
        ) : null}
      </div>

      {/* Barra con su alto reservado aunque no haya total. Recta, sin adornos. */}
      <div aria-hidden="true" className="h-1 bg-sala-border">
        <div
          data-testid="progress-fill"
          className="h-1 bg-sala-ink motion-safe:transition-[width] motion-safe:duration-sala-slow motion-safe:ease-sala"
          style={{ width: `${done ? 100 : (percent ?? 0)}%` }}
        />
      </div>

      {unit ? (
        <div className="flex min-h-sala-target items-center">
          {done ? (
            <span ref={stampRef} tabIndex={-1} className="inline-flex min-h-sala-target items-center outline-none sala-type-label sala-focused:sala-focus">
              {td('stamp', { type: mediaType })}
            </span>
          ) : (
            <SalaButton
              ref={buttonRef}
              variant="secondary"
              onClick={state.advance}
              aria-busy={state.busy || undefined}
              // WCAG 2.5.3: el nombre es el texto visible («+1 cap.»); el
              // título y la frase completa van en la descripción.
              aria-describedby={descId}
              data-testid="progress-next"
              className={cn('tabular-nums', hero ? undefined : 'w-full px-3')}
            >
              {t('quick', { unit })}
            </SalaButton>
          )}
          <span id={descId} hidden>
            {unit ? t('quickLabel', { unit, title }) : null}
          </span>
        </div>
      ) : null}

      {/* Lo que pasa al tocar: se anuncia sin mover nada. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.announcement?.tone === 'polite' ? state.announcement.text : ''}
      </span>
      {/* Hueco reservado para el aviso de error: aparece sin empujar nada (CLS 0). */}
      <p role="alert" className="min-h-5 text-sala-danger sala-type-small line-clamp-3">
        {state.announcement?.tone === 'alert' ? state.announcement.text : ''}
      </p>

      <SalaConfirmDialog
        open={state.finish !== null}
        title={t('finishTitle', { title })}
        message={t('finishBody', { type: mediaType })}
        cancelLabel={t('finishCancel')}
        confirmLabel={t('finishConfirm', { type: mediaType })}
        onCancel={state.dismissFinish}
        onConfirm={() => state.complete(diary && log)}
        loading={state.completing}
        loadingLabel={t('finishConfirm', { type: mediaType })}
        error={state.finishError}
        finalFocusRef={buttonRef}
      >
        {diary ? <SalaCheckbox label={t('finishLog')} checked={log} onChange={(e) => setLog(e.target.checked)} /> : null}
      </SalaConfirmDialog>
    </div>
  )
}
