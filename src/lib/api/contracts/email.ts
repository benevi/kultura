// ============================================================
// KULTURA — Contrato de /api/email/preferences (saneamiento 9)
//
// /api/email/preferences   PUT: alta (pide confirmación, 202) o baja (200)
//                 del correo semanal. `data: EmailPreferenceResult`; errores
//                 con `EMAIL_PREFERENCE_ERRORS` en `message`.
// ============================================================

import { z } from 'zod'

export { EMAIL_PREFERENCE_ERRORS } from '@/lib/email/errors'

/** PUT /api/email/preferences. `consentVersion` y `locale` se comprueban aparte. */
export const emailPreferencesSchema = z.object({
  weekly: z.boolean(),
  consentVersion: z.unknown().optional(),
  locale: z.unknown().optional(),
})

export interface EmailPreferenceResult {
  weekly: boolean
  /** `true` tras pedir el alta: falta pulsar el enlace del correo. */
  pending: boolean
  /** Solo cuando no queda nada pendiente. */
  consentedAt?: string | null
}
