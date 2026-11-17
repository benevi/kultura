// ============================================================
// KULTURA — Route Handler: /api/library/bulk (saneamiento 6.4)
// POST: añade como Pendiente varios títulos de una vez («Añadir toda la
//       franquicia»). Solo inserta; lo que ya está no se toca.
// Con un solo título es el añadir rápido de Descubrir (límite propio).
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
  const body = await parseBody(request, libraryBulkSchema)
  if (!body.ok) return body.response
  // Un solo título es el «+» de Descubrir (fase 8.2): se añaden varios
  // seguidos, así que lleva un límite propio, más holgado que el de la
  // franquicia entera (hasta 24 títulos por petición).
  const single = body.value.mediaIds.length === 1
  const limited = await rateLimit(request, {
    key: single ? 'library_quick_add' : 'library_bulk',
    limit: single ? LIMITS.library_quick_add : LIMITS.library_bulk,
    userId: auth.user.id,
  })
  if (limited) return limited

  return respond(
    await addPendingBulk(auth.supabase, auth.user, body.value.mediaIds, { locale: localeFromRequest(request) })
  )
}
