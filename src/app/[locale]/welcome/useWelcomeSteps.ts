'use client'

import { useEffect, useRef, useState } from 'react'
import { initialSteps, type Step } from './welcome-steps'

/** Paso actual del onboarding, avance y retroceso, y el foco al título de cada paso. */
export function useWelcomeSteps(rateFirst: boolean, needsTerms: boolean) {
  // El orden se fija al entrar: no cambia a mitad del recorrido.
  const [steps] = useState<readonly Step[]>(() => initialSteps(rateFirst, needsTerms))
  const [step, setStep] = useState<Step>(steps[0])
  const stepIndex = steps.indexOf(step)
  const isFirstStep = stepIndex === 0
  const goNext = () => setStep(steps[Math.min(stepIndex + 1, steps.length - 1)])
  const goBack = () => setStep(steps[Math.max(stepIndex - 1, 0)])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  // El foco va al título de cada paso nuevo (el lector lo anuncia), nunca al
  // cargar la página.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
    window.scrollTo({ top: 0 })
  }, [step])

  return { steps, step, setStep, stepIndex, isFirstStep, goNext, goBack, headingRef }
}
