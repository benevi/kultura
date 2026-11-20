'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { cn } from '@/lib/utils/index'
import type { StarterTitle } from '@/lib/recommendations/starter-titles'
import { RateStars } from './RateStars'

interface RateTileProps {
  title: StarterTitle
  locale: 'es' | 'en'
  score: number
  priority: boolean
  formatLabel: string
  onRate: (score: number) => void
}

/** Portada con el gradiente SIEMPRE detrás (por si la imagen falla) y sus estrellas. */
export function RateTile({ title, locale, score, priority, formatLabel, onRate }: RateTileProps) {
  const t = useTranslations('onboarding')
  const name = title.title[locale]
  const rated = score > 0
  // Portada caída (404, CDN bloqueado): fuera la <img> rota, queda el gradiente.
  const [posterFailed, setPosterFailed] = useState(false)
  return (
    <li className="relative flex flex-col">
      {rated ? (
        <span
          aria-hidden="true"
          className="absolute -left-2 -top-2 z-10 rotate-[-8deg] rounded-pill bg-accent-lime px-2.5 py-1 font-display text-xs font-extrabold text-on-accent-lime shadow-sticker"
        >
          ★ {score}
        </span>
      ) : null}
      <div
        className={cn(
          'relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surface-elevated transition-shadow duration-200',
          rated && 'ring-2 ring-accent-lime ring-offset-2 ring-offset-surface-base'
        )}
      >
        <div aria-hidden="true" className="absolute inset-0" style={{ background: posterGradient(title.id) }} />
        {!posterFailed && (
          <PosterImage
            src={title.poster}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            priority={priority}
            className="object-cover"
            onFail={() => setPosterFailed(true)}
          />
        )}
      </div>
      <p className="mt-3 line-clamp-2 font-body text-sm font-bold text-text-primary">{name}</p>
      <p className="font-body text-xs text-text-tertiary">
        {formatLabel}
        {title.year ? ` · ${title.year}` : ''}
      </p>
      <div className="mt-2">
        <RateStars value={score} onChange={onRate} label={t('rateLabel', { title: name })} />
      </div>
    </li>
  )
}
