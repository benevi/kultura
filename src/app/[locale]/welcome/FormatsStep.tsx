'use client'

import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import type { MediaType } from '@/types/media'
import { AUTH_CARD } from '../login/AuthShell'
import { FormatChips } from './FormatChips'
import { BODY_CLASS, HEADING_CLASS } from './welcome-styles'

interface FormatsStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>
  formats: MediaType[]
  onFormatsChange: (next: MediaType[]) => void
  onBack: () => void
  onNext: () => void
}

/** Paso "formatos" (solo en el orden de siempre). */
export function FormatsStep({ headingRef, formats, onFormatsChange, onBack, onNext }: FormatsStepProps) {
  const t = useTranslations('onboarding')
  return (
    <section aria-labelledby="welcome-heading" className="animate-toast-in mx-auto w-full max-w-[640px]">
      <div className={AUTH_CARD}>
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={HEADING_CLASS}>
          {t('formatsTitle')}
        </h1>
        <p className={BODY_CLASS}>{t('formatsBody')}</p>

        <FormatChips formats={formats} onChange={onFormatsChange} className="mt-7" />

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <KButton type="button" variant="secondary" size="lg" onClick={onBack}>
            {t('back')}
          </KButton>
          <KButton type="button" size="lg" onClick={onNext}>
            {formats.length === 0 ? t('continueAll') : t('continue')}
          </KButton>
        </div>
      </div>
    </section>
  )
}
