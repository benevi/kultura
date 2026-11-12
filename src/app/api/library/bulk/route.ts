// ============================================================
// KULTURA — Route Handler: /api/library/bulk (saneamiento 6.4)
// POST: añade como Pendiente varios títulos de una vez («Añadir toda la
//       franquicia»). Solo inserta; lo que ya está no se toca.
// Respuesta: `{ data: { added, skipped, failed } }` o `{ error: { code } }`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { libraryBulkSchema } from '@/lib/api/contracts/library'
import { addPendingBulk } from '@/lib/library/service'
import { localeFromRequest } from '@/lib/media/request-locale'

/** POST /api/library/bulk */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library_bulk', limit: LIMITS.library_bulk, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, libraryBulkSchema)
  if (!body.ok) return body.response

  return respond(
    await addPendingBulk(auth.supabase, auth.user, body.value.mediaIds, { locale: localeFromRequest(request) })
  )
}
