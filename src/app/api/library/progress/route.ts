// ============================================================
// KULTURA — Route Handler: /api/library/progress (F-27, PRO-5)
// GET ?mediaId=…                         → cómo va el título y el plan del proveedor.
// POST { mediaId, action: 'next' }       → «marcar siguiente».
// POST { mediaId, action: 'complete', log?, watchedOn? } → «Completado».
// Lógica en `lib/library/progress-service.ts`; contrato en
// `lib/api/contracts/library.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, ok, parseBody, parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { progressPostSchema, progressQuerySchema } from '@/lib/api/contracts/library'
import { advance, complete, readProgress } from '@/lib/library/progress-service'
import { localeFromRequest } from '@/lib/media/request-locale'
import { parseMediaId } from '@/lib/media/media-id'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** Un id con el formato bien pero de un tipo o forma que no existe. */
const unknownMedia = () => apiError('invalid_input', { field: 'mediaId', message: 'Unknown media id' })

export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // Cupo propio: abrir fichas no gasta el de guardar ni al revés.
  const limited = await rateLimit(request, { key: 'library_progress', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const query = parseQuery(request, progressQuerySchema)
  if (!query.ok) return query.response
  const media = parseMediaId(query.value.mediaId)
  if (!media) return unknownMedia()

  const result = await readProgress(auth.supabase, auth.user.id, media, localeFromRequest(request))
  return result.ok ? ok(result.value, { headers: NO_STORE }) : respond(result)
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, progressPostSchema)
  if (!body.ok) return body.response
  const media = parseMediaId(body.value.mediaId)
  if (!media) return unknownMedia()

  if (body.value.action === 'complete') {
    return respond(
      await complete(auth.supabase, auth.user, media, { log: body.value.log === true, watchedOn: body.value.watchedOn })
    )
  }
  return respond(await advance(auth.supabase, auth.user, media, localeFromRequest(request)))
}
