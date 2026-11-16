// ============================================================
// KULTURA — Route Handler: /api/recommendations
// POST: crear una recomendación directa entre amigos.
// Crea fila en `recommendations` + fila en `notifications`.
//
// La lógica está en `lib/recommendations/service.ts`; el contrato en
// `lib/api/contracts/recommendations.ts`. Respuesta: 201 `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 7 y 9).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { recommendationCreateSchema } from '@/lib/api/contracts/recommendations'
import { recommendToFriend } from '@/lib/recommendations/service'
import { localeFromRequest } from '@/lib/media/request-locale'

/** Cuerpo máximo: mensaje de 500 caracteres y el `mediaCache` que aún manda el cliente. */
const MAX_BYTES = 32_768

/** POST /api/recommendations */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // 10 por minuto por usuario.
  const limited = await rateLimit(request, {
    key: 'recommendations',
    limit: LIMITS.recommendations,
    userId: auth.user.id,
  })
  if (limited) return limited
  const body = await parseBody(request, recommendationCreateSchema, { maxBytes: MAX_BYTES })
  if (!body.ok) return body.response

  const result = await recommendToFriend(auth.supabase, auth.user, body.value, {
    locale: localeFromRequest(request),
  })
  return respond(result, { status: 201 })
}
