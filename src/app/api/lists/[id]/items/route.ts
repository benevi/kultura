// ============================================================
// KULTURA — Route Handler: /api/lists/[id]/items
// POST   { mediaId }         → añadir un título (201; `mediaCache` se ignora)
// DELETE { itemId }          → quitar un título
// PATCH  { order: itemId[] } → orden manual completo (F-25)
// PATCH  { itemId, note }    → nota de un título (F-25)
// Dueño o miembro de una lista colaborativa.
// ============================================================

import { parseBody, respond } from '@/lib/api/route'
import { itemAddSchema, itemRemoveSchema, itemsPatchSchema } from '@/lib/api/contracts/lists'
import { addItem, patchItems, removeItem } from '@/lib/lists/service'
import { guardList } from '@/lib/lists/guard'
import { localeFromRequest } from '@/lib/media/request-locale'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/lists/[id]/items */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, itemAddSchema)
  if (!body.ok) return body.response

  return respond(
    await addItem(guard.supabase, guard.user.id, guard.listId, body.value.mediaId, {
      locale: localeFromRequest(request),
    }),
    { status: 201 }
  )
}

/** DELETE /api/lists/[id]/items */
export async function DELETE(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, itemRemoveSchema)
  if (!body.ok) return body.response

  return respond(await removeItem(guard.supabase, guard.user.id, guard.listId, body.value.itemId))
}

/** PATCH /api/lists/[id]/items */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardList(request, params)
  if (!guard.ok) return guard.response
  const body = await parseBody(request, itemsPatchSchema)
  if (!body.ok) return body.response

  return respond(await patchItems(guard.supabase, guard.user.id, guard.listId, body.value))
}
