// ============================================================
// KULTURA — Route Handler: /api/library/prefs (F-24)
// PUT { ratingScale: 'stars' | 'ten' }: cómo ve y pone sus notas la persona.
// Se guarda en `user_metadata.rating_scale`; la cuenta demo es de solo
// lectura. Lógica en `lib/library/service.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { prefsPutSchema } from '@/lib/api/contracts/library'
import { setRatingScale } from '@/lib/library/service'

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, prefsPutSchema)
  if (!body.ok) return body.response

  return respond(await setRatingScale(auth.supabase, auth.user, body.value.ratingScale))
}
