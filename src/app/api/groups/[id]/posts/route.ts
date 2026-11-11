// ============================================================
// KULTURA — Route Handler: /api/groups/[id]/posts (saneamiento 4.6)
// POST: { content } → publicar (201). Valida y limita antes de insertar;
// quién puede publicar (miembro, sin veto) lo decide la RLS.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { groupPostSchema } from '@/lib/api/contracts/groups'
import { uuidSchema } from '@/lib/api/contracts/common'
import { createPost } from '@/lib/groups/service'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/groups/[id]/posts */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'group_posts', limit: LIMITS.group_posts, userId: auth.user.id })
  if (limited) return limited
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) return apiError('not_found', { message: 'Group not found' })
  const body = await parseBody(request, groupPostSchema)
  if (!body.ok) return body.response

  return respond(await createPost(auth.supabase, auth.user.id, id, body.value.content), { status: 201 })
}
