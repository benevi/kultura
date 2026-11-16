// ============================================================
// KULTURA — Route Handler: /api/suggestions
// POST: guarda una sugerencia del usuario en Supabase.
//
// Contrato en `lib/api/contracts/suggestions.ts`. Respuesta: `{ data: null }`
// o `{ error: { code, message?, field? } }` (saneamiento 7 y 9).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, ok, parseBody, rateLimit, requireUser } from '@/lib/api/route'
import { suggestionSchema } from '@/lib/api/contracts/suggestions'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/suggestions')

/** Cuerpo máximo: 2000 caracteres de descripción con margen para UTF-8. */
const MAX_BYTES = 16_384

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'suggestions', limit: LIMITS.suggestions, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, suggestionSchema, { maxBytes: MAX_BYTES })
  if (!body.ok) return body.response

  const { error } = await auth.supabase.from('suggestions').insert({
    user_id: auth.user.id,
    type: body.value.type,
    subject: body.value.subject,
    description: body.value.description,
  })

  if (error) {
    log.error('suggestions insert error', { err: error })
    return apiError('internal')
  }

  return ok(null)
}
