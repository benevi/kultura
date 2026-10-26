'use client'

// ============================================================
// KULTURA — Progreso con «1 toque» en Inicio (F-27, PRO-5)
// Texto («T2 · E5», «45 %», «12 h de ~22 h»), barra y botón que marca lo
// siguiente. Todo con hueco fijo: el botón y la barra existen desde el
// primer pintado (vienen del servidor), así que nada se mueve (CLS 0). La
// barra solo anima su anchura y nada con movimiento reducido.
// ============================================================

import { useEffect, useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import { KButton } from '@/components/ui/KButton'
import { FinishPrompt } from '@/components/library/FinishPrompt'
import { useProgressAdvance } from '@/components/library/useProgressAdvance'
import { useProgressLabel } from '@/components/library/useProgressLabel'
import { playStamp } from '@/lib/library/motion'
import {
  progressKindFor,
  progressPercent,
  quickUnit,
  supportsLegacyProgress,
  type ProgressValue,
} from '@/lib/library/progress'
import type { LibraryStatus } from '@/types/library'

export interface ContinueProgressProps {
  mediaId: string
  mediaType: string
  title: string
  progress: ProgressValue | null
  status: LibraryStatus
  variant: 'hero' | 'card'
}

/** ¿Este título tiene «1 toque» en Inicio? (lo decide el servidor al pintar). */
export function canQuickAdvance(mediaType: string, full: boolean): boolean {
  if (!progressKindFor(mediaType)) return false
  return full || supportsLegacyProgress(mediaType)
}

export function ContinueProgress({ mediaId, mediaType, title, progress: initial, status: initialStatus, variant }: ContinueProgressProps) {
  const t = useTranslations('progress')
  const td = useTranslations('diary')
  const tl = useTranslations('library')
  const label = useProgressLabel()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const stampRef = useRef<HTMLSpanElement>(null)
  const descId = useId()
  const state = useProgressAdvance({ mediaId, mediaType, title, progress: initial, status: initialStatus })
  const { progress, status } = state

  const done = status === 'completed'
  const percent = progressPercent(mediaType, progress)
  const unit = quickUnit(mediaType, progress)
  const hero = variant === 'hero'

  useEffect(() => {
    if (done) playStamp(stampRef.current)
  }, [done])

  return (
    <div className={cn('flex flex-col', hero ? 'gap-2 w-full max-w-xs' : 'gap-1.5 mt-1.5')}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'font-body font-bold tabular-nums text-text-secondary truncate',
            hero ? 'text-sm' : 'text-xs'
          )}
          data-testid="progress-label"
        >
          {done ? tl('status.completed') : label(mediaType, progress)}
        </span>
        {/* En % la etiqueta ya dice el porcentaje: no se repite. */}
        {percent !== null && !done && unit !== 'percent' ? (
          <span className="font-body text-xs text-text-tertiary tabular-nums">{t('percentDone', { percent })}</span>
        ) : null}
      </div>

      {/* Barra con su alto reservado aunque no haya total. */}
      <div aria-hidden="true" className={cn('rounded-full bg-surface-elevated', hero ? 'h-1.5' : 'h-1')}>
        <div
          data-testid="progress-fill"
          className={cn('rounded-full bg-accent-positive motion-safe:transition-[width] motion-safe:duration-slow', hero ? 'h-1.5' : 'h-1')}
          style={{ width: `${done ? 100 : (percent ?? 0)}%` }}
        />
      </div>

      {unit && (
        <div className="flex min-h-11 items-center">
          {done ? (
            <span
              ref={stampRef}
              className="inline-flex min-h-9 items-center rounded-full bg-accent-lime px-3 text-xs font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.4)]"
            >
              {td('stamp', { type: mediaType })}
            </span>
          ) : (
            <KButton
              ref={buttonRef}
              type="button"
              variant="secondary"
              onClick={state.advance}
              aria-busy={state.busy || undefined}
              // WCAG 2.5.3: el nombre es el texto visible («+1 ep.»); el
              // título y la frase completa van en la descripción.
              aria-describedby={descId}
              data-testid="progress-next"
              // 44 px de alto (zona táctil) en los dos tamaños.
              className={cn('h-11 text-text-primary', hero ? 'px-5 text-sm' : 'min-w-11 px-3 text-xs')}
            >
              <span aria-hidden="true">✓</span>
              <span>{t('quick', { unit })}</span>
              <span id={descId} hidden>
                {t('quickLabel', { unit, title })}
              </span>
            </KButton>
          )}
        </div>
      )}

      {/* Lo que pasa al tocar: se anuncia sin mover nada. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.announcement?.tone === 'polite' ? state.announcement.text : ''}
      </span>
      {/* Hueco reservado (2 líneas) para el aviso: aparece sin empujar nada (CLS 0). */}
      <p role="alert" className="min-h-8 text-xs font-medium leading-4 text-accent-danger line-clamp-2">
        {state.announcement?.tone === 'alert' ? state.announcement.text : ''}
      </p>

      <FinishPrompt
        open={state.finish !== null}
        title={title}
        mediaType={mediaType}
        diary={state.finish?.diary ?? false}
        loading={state.completing}
        error={state.finishError}
        onConfirm={state.complete}
        onCancel={state.dismissFinish}
        finalFocusRef={buttonRef}
      />
    </div>
  )
}
