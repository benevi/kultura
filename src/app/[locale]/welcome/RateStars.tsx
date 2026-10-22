'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'

interface RateStarsProps {
  /** 0 = sin nota. */
  value: number
  onChange: (value: number) => void
  /** Nombre del grupo para el lector ("Tu nota para Origen"). */
  label: string
}

/**
 * Las cinco estrellas de `StarRating` (mismo polígono, mismo `accent-highlight`)
 * como grupo de radio accesible: un solo tope de tabulador por título, flechas
 * para cambiar la nota y nombre traducido en cada estrella. En el paso 3 hay
 * diez títulos seguidos; con cinco botones sueltos por título serían 50 Tab.
 * Cada estrella mide 32 px (≥ 24 px de WCAG 2.5.8) para que las cinco quepan en
 * una portada de 2 columnas a 320 px.
 */
export function RateStars({ value, onChange, label }: RateStarsProps) {
  const t = useTranslations('onboarding')
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const focusable = value > 0 ? value : 1

  function move(next: number) {
    const clamped = Math.min(5, Math.max(1, next))
    onChange(clamped)
    refs.current[clamped - 1]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value
        return (
          <button
            key={star}
            ref={(el) => {
              refs.current[star - 1] = el
            }}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={t('stars', { count: star })}
            tabIndex={star === focusable ? 0 : -1}
            onClick={() => onChange(star)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(star + 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(star - 1)
              } else if (e.key === 'Home') {
                e.preventDefault()
                move(1)
              } else if (e.key === 'End') {
                e.preventDefault()
                move(5)
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-transform duration-150 ease-out hover:scale-110 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <svg
              viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className={cn('h-6 w-6', filled ? 'text-accent-highlight' : 'text-text-tertiary')}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
