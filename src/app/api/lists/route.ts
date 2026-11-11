// ============================================================
// KULTURA — Route Handler: /api/lists
// GET:  mis listas (con filtro ?mediaType=)
// POST: crear una lista (201)
// Borrar una lista: DELETE /api/lists/[id].
//
// La lógica está en `lib/lists/service.ts`; el contrato en
// `lib/api/contracts/lists.ts`. Respuesta: `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 6 y 7).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { listCreateSchema, listsQuerySchema } from '@/lib/api/contracts/lists'
import { createList, listMyLists } from '@/lib/lists/service'

/** GET /api/lists — mis listas, opcionalmente filtradas por ?mediaType= */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const query = parseQuery(request, listsQuerySchema)
  if (!query.ok) return query.response

  return respond(await listMyLists(auth.supabase, auth.user.id, query.value.mediaType))
}

/** POST /api/lists — crear lista */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'lists', limit: LIMITS.lists, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, listCreateSchema)
  if (!body.ok) return body.response

  return respond(await createList(auth.supabase, auth.user, body.value), { status: 201 })
}
