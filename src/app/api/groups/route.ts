// ============================================================
// KULTURA — Route Handler: /api/groups
// GET:  mis grupos (dueño o miembro), con mi rol
// POST: crear un grupo (201)
//
// La lógica está en `lib/groups/service.ts`; el contrato en
// `lib/api/contracts/groups.ts`. Respuesta: `{ data }` o
// `{ error: { code, message?, field? } }` (saneamiento 6 y 7).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { groupCreateSchema } from '@/lib/api/contracts/groups'
import { createGroup, listMyGroups } from '@/lib/groups/service'

/** GET /api/groups */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return respond(await listMyGroups(auth.user.id))
}

/** POST /api/groups */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'groups', limit: LIMITS.groups, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, groupCreateSchema)
  if (!body.ok) return body.response

  return respond(await createGroup(auth.user.id, body.value), { status: 201 })
}
