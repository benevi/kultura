// ============================================================
// KULTURA — Route Handler: /api/lists/[id]
// PATCH:  { isPublic?, name?, description? } → datos de la lista (solo el dueño)
// DELETE: borrar la lista (solo el dueño)
//
// Títulos: /api/lists/[id]/items. Miembros: /api/lists/[id]/members.
// ============================================================

import { parseBody, respond } from '@/lib/api/route'
import { listPatchSchema } from '@/lib/api/contracts/lists'
import { deleteList, updateList } from '@/lib/lists/service'
import { guardList } from '@/lib/lists/guard'

interface Params {
  params: Promise<{ id: string }>
}

/** PATCH /api/lists/[id] */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, listPatchSchema)
  if (!body.ok) return body.response

  return respond(await updateList(guard.supabase, guard.user, guard.listId, body.value))
}

/** DELETE /api/lists/[id] */
export async function DELETE(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response

  return respond(await deleteList(guard.supabase, guard.user.id, guard.listId))
}
