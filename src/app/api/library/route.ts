// ============================================================
// KULTURA — Route Handler: /api/library
// POST: upsert de una entrada (status, nota, progreso, favorito) y, si llega,
//       un apunte del diario. DELETE: borrar una entrada.
// La lógica está en `lib/library/service.ts`; el contrato (entrada y
// salida) en `lib/api/contracts/library.ts`. Respuesta: `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 6 y 7).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { libraryDeleteSchema, libraryPostSchema } from '@/lib/api/contracts/library'
import { removeEntry, saveEntry } from '@/lib/library/service'
import { localeFromRequest } from '@/lib/media/request-locale'

/** POST /api/library — upsert en user_media */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, libraryPostSchema)
  if (!body.ok) return body.response

  return respond(
    await saveEntry(auth.supabase, auth.user, body.value, { locale: localeFromRequest(request) })
  )
}

/** DELETE /api/library — eliminar entrada de user_media */
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, libraryDeleteSchema)
  if (!body.ok) return body.response

  return respond(await removeEntry(auth.supabase, auth.user.id, body.value.mediaId))
}
