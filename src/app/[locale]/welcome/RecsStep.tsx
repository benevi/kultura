'use client'

import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { AiRecommendations } from '@/components/home/AiRecommendations'
import { STARTER_MIN_RATINGS } from '@/lib/recommendations/starter-titles'
import type { StarterRatings } from './useStarterRatings'
import { BODY_CLASS, HEADING_CLASS } from './welcome-styles'

interface RecsStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>
  ratings: StarterRatings
  finishing: boolean
  onBack: () => void
  onFinish: () => void
}

/** Paso "recomendaciones": el botón de "Para ti" y terminar. */
export function RecsStep({ headingRef, ratings, finishing, onBack, onFinish }: RecsStepProps) {
  const t = useTranslations('onboarding')
  const { ratedCount } = ratings
  return (
    <section aria-labelledby="welcome-heading" className="animate-toast-in flex flex-col gap-8">
      <div>
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={HEADING_CLASS}>
          {t('recsTitle')}
        </h1>
        <p className={BODY_CLASS}>
          {ratedCount >= STARTER_MIN_RATINGS ? t('recsBody') : t('recsBodyNoRatings')}
        </p>
      </div>

      <AiRecommendations />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <KButton type="button" variant="secondary" size="lg" onClick={onBack}>
          {t('back')}
        </KButton>
        <KButton type="button" size="lg" loading={finishing} onClick={onFinish}>
          {t('finish')}
        </KButton>
      </div>
    </section>
  )
}
