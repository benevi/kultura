'use client'

// ============================================================
// KULTURA — RatingInput (F-24, D-14)
// La nota de un título en la escala de cada persona:
//   - `legacy`: 1-5 estrellas enteras (sin RATING_SCALE_10, como siempre).
//   - `stars`:  medias estrellas (½ a 5).
//   - `ten`:    deslizador de 0,5 a 10 en pasos de 0,5.
// Siempre trabaja en rating10 (0,5-10; null = sin nota). La fila mide lo
// mismo (48 px) en los tres modos: cambiar de modo al llegar la preferencia
// no mueve el resto del diálogo (CLS 0).
// ============================================================

import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { StarRating } from '@/components/ui/StarRating'
import { cn } from '@/lib/utils/index'
import {
  RATING10_MAX,
  RATING10_MIN,
  RATING10_STEP,
  halfStarsToRating10,
  normalizeRating10,
  rating10ToHalfStars,
  rating10ToScore,
} from '@/lib/library/rating'
import type { RatingScale } from '@/types/library'

export type RatingMode = 'legacy' | RatingScale

interface RatingInputProps {
  mode: RatingMode
  rating10: number | null
  onChange: (rating10: number | null) => void
  /** id del texto «Puntuación» que nombra el control. */
  labelId: string
  className?: string
}

/** Valor del deslizador cuando aún no hay nota (centro de la escala). */
const SLIDER_REST = 5

export function RatingInput({ mode, rating10, onChange, labelId, className }: RatingInputProps) {
  const t = useTranslations('diary')
  const locale = useLocale()
  const outputId = useId()
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

  const clear =
    rating10 !== null ? (
      <button
        type="button"
        onClick={() => onChange(null)}
        className="ml-auto shrink-0 min-h-11 px-2 rounded-lg text-sm font-body text-text-secondary underline-offset-2 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        {t('clearRating')}
      </button>
    ) : null

  if (mode === 'ten') {
    const commit = (raw: string) => onChange(normalizeRating10(raw))
    return (
      <div className={cn('flex h-12 items-center gap-3', className)}>
        <input
          type="range"
          min={RATING10_MIN}
          max={RATING10_MAX}
          step={RATING10_STEP}
          value={rating10 ?? SLIDER_REST}
          onChange={(e) => commit(e.currentTarget.value)}
          // Sin nota, el primer toque o tecla sobre el punto de reposo también puntúa.
          onPointerUp={(e) => { if (rating10 === null) commit(e.currentTarget.value) }}
          onKeyUp={(e) => { if (rating10 === null && e.key === 'Enter') commit(e.currentTarget.value) }}
          aria-labelledby={labelId}
          aria-describedby={outputId}
          aria-valuetext={rating10 === null ? t('notRated') : t('ratingOfTen', { value: rating10 })}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-accent-highlight focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        />
        <output
          id={outputId}
          aria-live="off"
          className="w-[4.5rem] shrink-0 text-right font-display text-xl font-extrabold tabular-nums text-text-primary"
        >
          {rating10 === null ? '—' : fmt.format(rating10)}
          <span className="text-sm font-body font-medium text-text-tertiary">/10</span>
        </output>
        {clear}
      </div>
    )
  }

  if (mode === 'stars') {
    return (
      <div className={cn('flex h-12 items-center', className)}>
        <StarRating
          value={rating10ToHalfStars(rating10)}
          onChange={(stars) => onChange(halfStarsToRating10(stars))}
          step={0.5}
          size="lg"
          aria-labelledby={labelId}
          className="-ml-3"
        />
        {clear}
      </div>
    )
  }

  return (
    <div className={cn('flex h-12 items-center', className)}>
      <StarRating
        value={rating10ToScore(rating10) ?? 0}
        onChange={(stars) => onChange(stars * 2)}
        size="lg"
        aria-labelledby={labelId}
        className="-ml-2.5"
      />
      {clear}
    </div>
  )
}
