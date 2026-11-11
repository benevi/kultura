// ============================================================
// KULTURA — Route Handler: /api/lists/[id]/members
// POST   { userId } → invitar a un amigo (solo el dueño, lista colaborativa; 201)
// DELETE { userId } → quitar a un miembro (el dueño) o salir (el propio miembro)
// ============================================================

import { parseBody, respond } from '@/lib/api/route'
import { memberSchema } from '@/lib/api/contracts/lists'
import { inviteMember, removeMember } from '@/lib/lists/service'
import { guardList } from '@/lib/lists/guard'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/lists/[id]/members */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, memberSchema)
  if (!body.ok) return body.response

  return respond(await inviteMember(guard.supabase, guard.user.id, guard.listId, body.value.userId), {
    status: 201,
  })
}

/** DELETE /api/lists/[id]/members */
export async function DELETE(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, memberSchema)
  if (!body.ok) return body.response

  return respond(await removeMember(guard.supabase, guard.user.id, guard.listId, body.value.userId))
}
