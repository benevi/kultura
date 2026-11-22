'use client'

// ============================================================
// KULTURA — SalaRatingInput (fase 8.5, ficha con `SALA_FICHA`)
// La nota de un título en «Sala»: un deslizador nativo en las tres escalas
// de `RatingInput` (misma conversión, `lib/library/rating`):
//   - `legacy`: 1-5 enteras (mientras no ha cargado el diario).
//   - `stars`:  ½ a 5 en medios puntos.
//   - `ten`:    0,5 a 10 en pasos de 0,5.
// Sin estrellas dibujadas: la nota va en cifras, al lado, con su escala
// («3,5 / 5», «7,5 / 10»). Flechas, Inicio y Fin funcionan de serie. La fila
// mide 48 px en los tres modos: cambiar de modo no mueve el diálogo (CLS 0).
// ============================================================

import { useId, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { cn } from '@/lib/utils/index'
import {
  RATING10_MAX,
  RATING10_MIN,
  RATING10_STEP,
  halfStarsToRating10,
  normalizeRating10,
  rating10ToHalfStars,
  rating10ToScore,
  scoreToRating10,
} from '@/lib/library/rating'
import type { RatingMode } from '@/components/library/RatingInput'

interface SalaRatingInputProps {
  mode: RatingMode
  rating10: number | null
  onChange: (rating10: number | null) => void
  /** id del texto «Puntuación» que nombra el control. */
  labelId: string
  className?: string
}

interface Scale {
  min: number
  max: number
  step: number
  /** Punto de reposo sin nota (centro de la escala). */
  rest: number
  toValue: (rating10: number | null) => number | null
  toRating10: (value: number) => number | null
}

const SCALES: Record<RatingMode, Scale> = {
  ten: {
    min: RATING10_MIN,
    max: RATING10_MAX,
    step: RATING10_STEP,
    rest: 5,
    toValue: (r) => r,
    toRating10: (v) => normalizeRating10(String(v)),
  },
  stars: {
    min: 0.5,
    max: 5,
    step: 0.5,
    rest: 2.5,
    toValue: (r) => (r === null ? null : rating10ToHalfStars(r)),
    toRating10: (v) => halfStarsToRating10(v),
  },
  legacy: {
    min: 1,
    max: 5,
    step: 1,
    rest: 3,
    toValue: (r) => rating10ToScore(r),
    toRating10: (v) => scoreToRating10(v),
  },
}

export function SalaRatingInput({ mode, rating10, onChange, labelId, className }: SalaRatingInputProps) {
  const t = useTranslations('diary')
  const tc = useTranslations('common')
  const locale = useLocale()
  const outputId = useId()
  const sliderRef = useRef<HTMLInputElement>(null)
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const scale = SCALES[mode]
  const value = scale.toValue(rating10)
  const commit = (raw: string) => {
    const n = Number(raw)
    if (Number.isFinite(n)) onChange(scale.toRating10(n))
  }

  const valueText =
    value === null
      ? t('notRated')
      : mode === 'ten'
        ? t('ratingOfTen', { value })
        : tc('ratingOf', { value: fmt.format(value), max: scale.max })

  return (
    <div className={cn('flex min-h-sala-target flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <input
        ref={sliderRef}
        type="range"
        min={scale.min}
        max={scale.max}
        step={scale.step}
        value={value ?? scale.rest}
        onChange={(e) => commit(e.currentTarget.value)}
        // Sin nota, el primer toque o tecla sobre el punto de reposo también puntúa.
        onPointerUp={(e) => {
          if (value === null) commit(e.currentTarget.value)
        }}
        onKeyUp={(e) => {
          if (value === null && e.key === 'Enter') commit(e.currentTarget.value)
        }}
        // El valor lo dice `aria-valuetext`; la cifra de al lado es solo para la vista.
        aria-labelledby={labelId}
        aria-valuetext={valueText}
        data-testid="sala-rating"
        className={cn(
          'h-sala-target min-w-[10rem] flex-1 cursor-pointer appearance-none bg-transparent',
          'sala-focused:sala-focus',
          // Pista con el borde de los controles (≥ 3:1) y tirador del acento con
          // borde de tinta: se ven igual en claro, en oscuro y con la paleta.
          '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-sala-border',
          '[&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-sala-border',
          '[&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-sala-ink [&::-webkit-slider-thumb]:bg-sala-accent',
          '[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-sala-ink [&::-moz-range-thumb]:bg-sala-accent',
          'forced-colors:appearance-auto'
        )}
      />
      <output
        id={outputId}
        aria-hidden="true"
        className="w-[5.5rem] shrink-0 text-right sala-type-data tabular-nums text-sala-ink"
      >
        {value === null ? '—' : fmt.format(value)}
        <span className="sala-type-small text-sala-ink-secondary"> / {scale.max}</span>
      </output>
      {rating10 !== null && (
        <SalaButton
          type="button"
          variant="quiet"
          onClick={() => {
            onChange(null)
            // El botón desaparece: el foco vuelve al deslizador.
            sliderRef.current?.focus()
          }}
        >
          {t('clearRating')}
        </SalaButton>
      )}
    </div>
  )
}
