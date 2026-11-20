'use client'

import type { RefObject } from 'react'
import { useTranslations, type AbstractIntlMessages } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import { STARTER_MIN_RATINGS, type StarterTitle } from '@/lib/recommendations/starter-titles'
import type { MediaType } from '@/types/media'
import { FormatChips } from './FormatChips'
import { RateTile } from './RateTile'
import { WelcomeImport } from './WelcomeImport'
import type { StarterRatings } from './useStarterRatings'
import { BODY_CLASS, HEADING_CLASS } from './welcome-steps'

interface RateStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>
  locale: 'es' | 'en'
  isFirstStep: boolean
  /** Sin paso de formatos (puntuar primero): los formatos van aquí como filtro. */
  showFormatFilter: boolean
  formats: MediaType[]
  onFormatsChange: (next: MediaType[]) => void
  titles: StarterTitle[]
  ratings: StarterRatings
  ratedCount: number
  importMessages: AbstractIntlMessages | null
  userId: string | null
  onImported: (inLibrary: number) => void
  onBack: () => void
  onNext: () => void
}

/** Paso "puntuar": títulos conocidos con sus estrellas y, opcional, importar (F-26). */
export function RateStep({
  headingRef,
  locale,
  isFirstStep,
  showFormatFilter,
  formats,
  onFormatsChange,
  titles,
  ratings,
  ratedCount,
  importMessages,
  userId,
  onImported,
  onBack,
  onNext,
}: RateStepProps) {
  const t = useTranslations('onboarding')
  const { scores, rateError, rate, flushRatings } = ratings

  return (
    <section aria-labelledby="welcome-heading" className="animate-toast-in flex flex-col gap-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={HEADING_CLASS}>
            {t('rateTitle')}
          </h1>
          <p className={BODY_CLASS}>{t('rateBody', { min: STARTER_MIN_RATINGS })}</p>
        </div>
        <p
          role="status"
          className={cn(
            'inline-flex w-fit flex-shrink-0 items-center gap-2 rounded-pill px-4 py-2 font-body text-sm font-extrabold',
            ratedCount >= STARTER_MIN_RATINGS
              ? 'bg-accent-lime text-on-accent-lime'
              : 'bg-surface-elevated text-text-primary'
          )}
        >
          {ratedCount >= STARTER_MIN_RATINGS
            ? t('rateReady', { count: ratedCount })
            : t('rateProgress', { count: ratedCount, min: STARTER_MIN_RATINGS })}
        </p>
      </div>

      {rateError && (
        <p role="alert" className="rounded-2xl bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
          {rateError}
        </p>
      )}

      {/* Sin paso de formatos (puntuar primero): aquí, como filtro opcional. */}
      {showFormatFilter && (
        <div>
          <p className="font-body text-sm font-bold text-text-secondary">{t('formatsTitle')}</p>
          <FormatChips formats={formats} onChange={onFormatsChange} className="mt-3" compact />
        </div>
      )}

      {/* F-26: quien viene de otra app se trae su historial en vez de puntuar a mano. */}
      <WelcomeImport locale={locale} messages={importMessages} userId={userId} onFinished={onImported} />

      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {titles.map((title, i) => (
          <RateTile
            key={title.id}
            title={title}
            locale={locale}
            score={scores[title.id] ?? 0}
            priority={i < 4}
            onRate={(score) => rate(title, score)}
            formatLabel={t(`formats.${title.type}`)}
          />
        ))}
      </ul>

      <div className={cn('flex flex-col-reverse gap-3 sm:flex-row sm:items-center', isFirstStep ? 'sm:justify-end' : 'sm:justify-between')}>
        {!isFirstStep && (
          <KButton type="button" variant="secondary" size="lg" onClick={onBack}>
            {t('back')}
          </KButton>
        )}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
          {ratedCount < STARTER_MIN_RATINGS && (
            <KButton
              type="button"
              variant="secondary"
              size="lg"
              onClick={async () => {
                await flushRatings()
                onNext()
              }}
            >
              {t('skipStep')}
            </KButton>
          )}
          <KButton
            type="button"
            size="lg"
            disabled={ratedCount < STARTER_MIN_RATINGS}
            aria-describedby={ratedCount < STARTER_MIN_RATINGS ? 'rate-min-hint' : undefined}
            onClick={async () => {
              await flushRatings()
              onNext()
            }}
          >
            {t('toRecommendations')}
          </KButton>
        </div>
      </div>
      {ratedCount < STARTER_MIN_RATINGS && (
        <p id="rate-min-hint" className="sr-only">
          {t('rateMinHint', { min: STARTER_MIN_RATINGS })}
        </p>
      )}
    </section>
  )
}
