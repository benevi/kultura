// ============================================================
// KULTURA — Route Handler: /api/groups/discover
// GET: grupos públicos para «Descubrir» (?q, scope, size, limit, offset).
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { discoverQuerySchema } from '@/lib/api/contracts/groups'
import { discoverGroups } from '@/lib/groups/service'

/** GET /api/groups/discover */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'groups_discover', limit: LIMITS.search, userId: auth.user.id })
  if (limited) return limited
  const query = parseQuery(request, discoverQuerySchema)
  if (!query.ok) return query.response

  return respond(await discoverGroups(query.value))
}
