// ============================================================
// KULTURA — Route Handler: /api/groups/[id]/join
// POST: entrar en el grupo (201, { joined: true }) o, si ya es miembro,
// salir (200, { joined: false }). El dueño no puede salir.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { toggleMembership } from '@/lib/groups/service'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/groups/[id]/join */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'groups_join', limit: LIMITS.groups_join, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return apiError('not_found', { message: 'Group not found' })

  const result = await toggleMembership(auth.supabase, auth.user.id, id)
  return respond(result, result.ok && result.value.joined ? { status: 201 } : undefined)
}
