// ============================================================
// KULTURA — Contrato de /api/suggestions (saneamiento 9)
//
// /api/suggestions   POST: guarda una sugerencia del usuario.
//                    `data: null`; 429 `rate_limited` (3 por hora).
// ============================================================

import { z } from 'zod'

/** POST /api/suggestions. */
export const suggestionSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'other']),
  subject: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
})

export type SuggestionInput = z.infer<typeof suggestionSchema>
