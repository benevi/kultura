// ============================================================
// KULTURA — Pasos del onboarding /welcome: orden y validación
// (piezas puras, sin React; las usan `WelcomeFlow` y sus hooks).
// ============================================================

import { USERNAME_REGEX, isReservedUsername } from '@/lib/account/identity'

const STEPS = ['name', 'formats', 'rate', 'recs'] as const
export type Step = (typeof STEPS)[number]
/**
 * Fase 8.2 («Llegar», bandera WELCOME_RATE_FIRST): la primera pantalla ya es
 * puntuar, así la primera obra entra antes de pedir nada. Los formatos pasan
 * a ser un filtro opcional dentro de ese paso y el nombre va después.
 */
const RATE_FIRST_STEPS: readonly Step[] = ['rate', 'name', 'recs']

/**
 * Orden de los pasos. Puntuar primero no se aplica si falta la casilla de
 * edad y términos (alta con Google): esa va siempre lo primero.
 */
export function initialSteps(rateFirst: boolean, needsTerms: boolean): readonly Step[] {
  return rateFirst && !needsTerms ? RATE_FIRST_STEPS : STEPS
}

/** Espera antes de guardar una nota: las flechas cambian la nota de una en una. */
export const SAVE_DEBOUNCE_MS = 500

/**
 * Error local del nombre (clave de `onboarding`), o `null` si vale. Solo se
 * valida si cambia: el nombre que ya tiene la cuenta no se vuelve a mirar.
 */
export function localUsernameError(value: string, changed: boolean): 'nameInvalid' | 'nameReserved' | null {
  if (changed && !USERNAME_REGEX.test(value)) return 'nameInvalid'
  if (changed && isReservedUsername(value)) return 'nameReserved'
  return null
}
