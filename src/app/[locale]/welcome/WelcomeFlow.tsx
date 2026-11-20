'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, type AbstractIntlMessages } from 'next-intl'
import { Logo } from '@/components/layout/Logo'
import { ApiError } from '@/lib/api/client'
import { updateSettings } from '@/lib/settings/client'
import { SETTINGS_ERRORS } from '@/lib/settings/errors'
import { pickStarterTitles } from '@/lib/recommendations/starter-titles'
import type { MediaType } from '@/types/media'
import { FormatsStep } from './FormatsStep'
import { NameStep } from './NameStep'
import { RateStep } from './RateStep'
import { RecsStep } from './RecsStep'
import { WelcomeProgress } from './WelcomeProgress'
import { useNameForm } from './useNameForm'
import { useStarterRatings } from './useStarterRatings'
import { useWelcomeSteps } from './useWelcomeSteps'

interface WelcomeFlowProps {
  locale: 'es' | 'en'
  /** Destino al terminar (ya saneado en el servidor). */
  next: string
  currentUsername: string
  /** El nombre actual es el generado (`u_xxxxxx`): se invita a cambiarlo. */
  suggestChange: boolean
  /** Alta con Google: falta la casilla de edad y términos (SEG-7). */
  needsTerms: boolean
  /**
   * Bandera WELCOME_RATE_FIRST (la lee el servidor). No se aplica si falta la
   * casilla de edad y términos (alta con Google): esa va siempre lo primero,
   * con el orden de siempre.
   */
  rateFirst?: boolean
  /** F-26: textos del paso opcional "Importar" (sin ellos no se ofrece). */
  importMessages?: AbstractIntlMessages | null
  /** F-26: cuenta de la sesión, para el avance guardado del importador. */
  userId?: string | null
}

export function WelcomeFlow({ locale, next, currentUsername, suggestChange, needsTerms, rateFirst = false, importMessages = null, userId = null }: WelcomeFlowProps) {
  const t = useTranslations('onboarding')
  const router = useRouter()

  const { steps, step, setStep, stepIndex, isFirstStep, goNext, goBack, headingRef } = useWelcomeSteps(rateFirst, needsTerms)

  // Paso "nombre" (+ términos si entró con Google)
  const nameForm = useNameForm({ currentUsername, suggestChange, needsTerms, onDone: goNext })

  // Paso "formatos" (o filtro dentro de "puntuar")
  const [formats, setFormats] = useState<MediaType[]>([])

  // Paso "puntuar"
  const titles = useMemo(() => pickStarterTitles(formats), [formats])
  const ratings = useStarterRatings(locale)

  const [finishing, setFinishing] = useState(false)

  // -------------------------------------------------------------------------
  // Fin (o saltar)
  // -------------------------------------------------------------------------

  async function finish() {
    // SEG-7: todo se puede saltar MENOS la casilla de edad y términos (alta
    // con Google). Sin marcarla, "Saltar" se queda en el paso 1 y lo explica.
    if (nameForm.termsPending && !nameForm.termsChecked) {
      setStep('name')
      nameForm.requireTerms({ focus: true })
      return
    }
    setFinishing(true)
    await ratings.flushRatings()
    // Casilla marcada pero aún sin guardar (salta desde el paso 1): va junta.
    const termsMissing = await updateSettings(
      nameForm.termsPending ? { accept_terms: true, onboarding_done: true } : { onboarding_done: true }
    ).then(
      () => false,
      (err) => err instanceof ApiError && err.message === SETTINGS_ERRORS.termsRequired
    )
    if (termsMissing) {
      // El servidor no tiene la aceptación: de vuelta a la casilla.
      setFinishing(false)
      setStep('name')
      nameForm.requireTerms({ focus: false })
      return
    }
    // Cualquier otro fallo: la próxima vez vuelve a ofrecerse; no impide entrar.
    router.replace(next)
  }

  return (
    <main className="min-h-dvh bg-surface-base py-6 md:py-10">
      <div className="page-grid flex flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Logo size={28} />
          {/* Saltar todo: nadie se queda atrapado en el onboarding. */}
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="min-h-[44px] rounded-pill px-3 font-body text-meta font-bold text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline disabled:opacity-40"
          >
            {t('skipAll')}
          </button>
        </header>

        <WelcomeProgress steps={steps} current={stepIndex} />

        {step === 'name' && (
          <NameStep form={nameForm} headingRef={headingRef} isFirstStep={isFirstStep} suggestChange={suggestChange} onBack={goBack} />
        )}

        {step === 'formats' && (
          <FormatsStep headingRef={headingRef} formats={formats} onFormatsChange={setFormats} onBack={goBack} onNext={goNext} />
        )}

        {step === 'rate' && (
          <RateStep
            headingRef={headingRef}
            locale={locale}
            isFirstStep={isFirstStep}
            showFormatFilter={!steps.includes('formats')}
            formats={formats}
            onFormatsChange={setFormats}
            titles={titles}
            ratings={ratings}
            importMessages={importMessages}
            userId={userId}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {step === 'recs' && (
          <RecsStep headingRef={headingRef} ratings={ratings} finishing={finishing} onBack={goBack} onFinish={finish} />
        )}
      </div>
    </main>
  )
}
