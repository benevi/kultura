// ============================================================
// KULTURA — Route Handler: /api/groups/[id]/posts/[postId] (F-11)
// DELETE: el autor borra su post y, con MODERATION_V2, el dueño cualquiera.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, respond } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'
import { deletePost } from '@/lib/groups/service'

interface Params {
  params: Promise<{ id: string; postId: string }>
}

/** DELETE /api/groups/[id]/posts/[postId] */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'group_post_delete', limit: LIMITS.groups_join, userId: auth.user.id })
  if (limited) return limited
  const { id, postId } = await params
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(postId).success) {
    return apiError('not_found', { message: 'Post not found' })
  }

  return respond(await deletePost(auth.supabase, auth.user.id, id, postId))
}
