// ============================================================
// KULTURA — Servicio de las listas (saneamiento 6.3)
// La lógica que antes vivía en /api/lists y /api/lists/[id]. No sabe de
// HTTP: recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
//
// F-25: con MIXED_LISTS=1 una lista puede ser `mixed`, llevar descripción y
// plantilla, y sus títulos orden manual y nota. Sin la bandera, descripción y
// plantilla se ignoran y orden y notas responden `not_found` (`not_available`).
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { track } from '@/lib/analytics/track'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { getListAccess } from '@/lib/social/lists'
import { upsertMediaFromProvider } from '@/lib/media/upsert-from-provider'
import { LIST_TEMPLATES, fitsList, listColumns, mixedListsEnabled, validListTypes } from '@/lib/social/lists-shared'
import {
  LIST_ERRORS,
  type ItemsPatchInput,
  type ListCreateInput,
  type ListPatchInput,
} from '@/lib/api/contracts/lists'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import type { TablesUpdate } from '@/types/supabase'
import type { ListTemplate } from '@/types/list'

const log = createLogger('lists/service')

export type ListRow = Record<string, unknown> & { id: string }

export interface ListItemRow {
  id: string
  list_id: string
  media_id: string
  added_by: string | null
  added_at: string
}

export interface ListPatchResult {
  isPublic?: boolean
  name?: string
  description?: string | null
}

// ── /api/lists ───────────────────────────────────────────────────────────────

/** Mis listas, las más nuevas primero. Con `mediaType`, las que admiten ese formato. */
export async function listMyLists(
  supabase: SupabaseClient,
  userId: string,
  mediaType: string | undefined
): Promise<ServiceResult<ListRow[]>> {
  const mixed = mixedListsEnabled()
  let query = supabase
    .from('lists')
    .select(listColumns(mixed))
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  // Una lista mixta admite cualquier formato: se ofrece siempre.
  if (mediaType && (validListTypes(mixed) as readonly string[]).includes(mediaType)) {
    query = mixed && mediaType !== 'mixed'
      ? query.in('media_type', [mediaType, 'mixed'])
      : query.eq('media_type', mediaType)
  }
  const { data, error } = await query
  if (error) {
    log.error('Failed to fetch lists', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to fetch lists' })
  }
  return success((data ?? []) as unknown as ListRow[])
}

export async function createList(
  supabase: SupabaseClient,
  user: User,
  input: ListCreateInput
): Promise<ServiceResult<ListRow>> {
  const mixed = mixedListsEnabled()
  const types = validListTypes(mixed) as readonly string[]
  if (!types.includes(input.mediaType)) {
    return failure('invalid_input', {
      field: 'mediaType',
      message: input.mediaType === 'mixed' ? LIST_ERRORS.mixedUnavailable : `mediaType must be one of: ${types.join(', ')}`,
    })
  }

  // Descripción y plantilla: solo con la bandera (sin ella, se ignoran).
  let template: ListTemplate | null = null
  if (mixed && input.template != null) {
    if (!(LIST_TEMPLATES as readonly string[]).includes(input.template)) {
      return failure('invalid_input', { field: 'template', message: `template must be one of: ${LIST_TEMPLATES.join(', ')}` })
    }
    template = input.template as ListTemplate
  }

  // D-04c: privada salvo que se pida lo contrario al crearla.
  const isPublic = input.isPublic === true
  const base = {
    // Id propio: la fila se lee DESPUÉS, en otra petición. Con `insert …
    // returning` la RLS de SELECT se evalúa sobre la fila nueva y
    // can_read_list (STABLE) aún no la ve: fallaba siempre.
    id: crypto.randomUUID(),
    owner_id: user.id,
    name: input.name,
    media_type: input.mediaType,
    is_collaborative: input.isCollaborative === true,
    is_public: isPublic,
  }
  const extra = mixed
    ? {
        ...(input.description != null ? { description: input.description } : {}),
        ...(template ? { template } : {}),
      }
    : {}

  const { error: insertError } = await supabase.from('lists').insert({ ...base, ...extra })
  if (insertError) {
    log.error('create list failed', { code: insertError.code, message: insertError.message })
    return failure('internal', { message: 'Failed to create list' })
  }

  const { data } = await supabase.from('lists').select(listColumns(mixed)).eq('id', base.id).maybeSingle()
  // Ya está creada: si la relectura fallase, se responde con lo insertado.
  const list = (data as ListRow | null) ?? { ...base, ...extra, created_at: new Date().toISOString() }

  // D-12: una lista que nace pública cuenta como "lista pública" del embudo.
  if (isPublic) {
    await track(user, 'list_made_public', { media_type: input.mediaType }, {
      dedupeKey: `list_made_public:${base.id}`,
    })
  }
  return success(list)
}

// ── /api/lists/[id] ──────────────────────────────────────────────────────────

/** Dueño de la lista: `not_found` si no existe, `forbidden` si no es suya. */
async function requireOwner(
  supabase: SupabaseClient,
  listId: string,
  userId: string
): Promise<ServiceResult<{ is_collaborative: boolean | null; name: string }>> {
  const { data } = await supabase
    .from('lists')
    .select('owner_id, is_collaborative, name')
    .eq('id', listId)
    .maybeSingle()
  const list = data as { owner_id: string; is_collaborative: boolean | null; name: string } | null
  if (!list) return failure('not_found', { message: 'List not found' })
  if (list.owner_id !== userId) return failure('forbidden')
  return success(list)
}

/** Borra la lista (solo el dueño; ítems y miembros caen por la FK). */
export async function deleteList(
  supabase: SupabaseClient,
  userId: string,
  listId: string
): Promise<ServiceResult<null>> {
  const owner = await requireOwner(supabase, listId, userId)
  if (!owner.ok) return owner
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) {
    log.error('delete list failed', { listId, code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to delete list' })
  }
  return success(null)
}

/** Nombre, visibilidad o descripción (solo el dueño). Devuelve lo que cambió. */
export async function updateList(
  supabase: SupabaseClient,
  user: User,
  listId: string,
  input: ListPatchInput
): Promise<ServiceResult<ListPatchResult>> {
  const update: TablesUpdate<'lists'> = {}
  if (input.isPublic !== undefined) update.is_public = input.isPublic
  if (input.name !== undefined) update.name = input.name
  // Sin la bandera la descripción se ignora (la columna existe, pero no se usa).
  if (input.description !== undefined && mixedListsEnabled()) update.description = input.description
  if (Object.keys(update).length === 0) return failure('invalid_input', { message: 'nothing to update' })

  // Un miembro de una colaborativa puede editar títulos, pero los datos son del dueño.
  const owner = await requireOwner(supabase, listId, user.id)
  if (!owner.ok) return owner

  const { error } = await supabase.from('lists').update(update).eq('id', listId).eq('owner_id', user.id)
  if (error) {
    log.error('PATCH list failed', { listId, message: error.message })
    return failure('internal', { message: 'Failed to update list' })
  }

  // D-12: primera vez que esta lista se hace pública (una vez por lista).
  if (update.is_public === true) {
    await track(user, 'list_made_public', {}, { dedupeKey: `list_made_public:${listId}` })
  }

  return success({
    ...('is_public' in update ? { isPublic: update.is_public as boolean } : {}),
    ...('name' in update ? { name: update.name as string } : {}),
    ...('description' in update ? { description: update.description ?? null } : {}),
  })
}

// ── /api/lists/[id]/items ────────────────────────────────────────────────────

/** Añade un título (dueño o miembro de una colaborativa). */
export async function addItem(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  mediaId: string,
  opts: { locale: string | null }
): Promise<ServiceResult<ListItemRow>> {
  const access = await getListAccess(listId, userId)
  if (!access.exists) return failure('not_found', { message: 'List not found' })
  if (!access.canEdit) return failure('forbidden')
  // Una lista de un formato solo admite ese formato; la mixta, todos.
  if (access.mediaType && !fitsList(access.mediaType, mediaId)) {
    return failure('invalid_input', { field: 'mediaId', message: LIST_ERRORS.typeMismatch })
  }

  const { data: existing } = await supabase
    .from('list_items')
    .select('id')
    .eq('list_id', listId)
    .eq('media_id', mediaId)
    .maybeSingle()
  if (existing) return failure('conflict', { message: 'Item already in list' })

  // La fila de `media` (FK de list_items) la garantiza el servidor con la
  // ficha del proveedor; `mediaCache` se ignora (SEG-2).
  const media = await upsertMediaFromProvider(mediaId, { locale: opts.locale })
  if (!media.ok) {
    if (media.reason === 'invalid_id') return failure('invalid_input', { field: 'mediaId', message: 'Unknown media id' })
    if (media.reason === 'unavailable') return failure('provider_unavailable', { message: 'Media provider unavailable' })
    return failure('internal', { message: 'Failed to cache media' })
  }

  // El RETURNING de list_items sí pasa la RLS: la lista ya existe y
  // can_read_list la ve. El disparador de F-25 pone `position` al final.
  const { data: item, error } = await supabase
    .from('list_items')
    .insert({ list_id: listId, media_id: mediaId, added_by: userId })
    .select('id, list_id, media_id, added_by, added_at')
    .single()
  // Saneamiento 3.1: otra petición lo añadió a la vez (único por lista).
  if (error?.code === '23505') return failure('conflict', { message: 'Item already in list' })
  if (error || !item) {
    log.error('add item failed', { listId, code: error?.code, message: error?.message })
    return failure('internal', { message: 'Failed to add item' })
  }
  return success(item as ListItemRow)
}

/** Quita un título. `not_found` si no estaba en esta lista. */
export async function removeItem(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  itemId: string
): Promise<ServiceResult<null>> {
  const access = await getListAccess(listId, userId)
  if (!access.exists) return failure('not_found', { message: 'List not found' })
  if (!access.canEdit) return failure('forbidden')

  const { error, count } = await supabase
    .from('list_items')
    .delete({ count: 'exact' })
    .eq('id', itemId)
    .eq('list_id', listId)
  if (error) {
    log.error('remove item failed', { listId, code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to remove item' })
  }
  if (count === 0) return failure('not_found', { message: 'Item not found' })
  return success(null)
}

/** Orden manual completo o nota de un título (F-25, quien pueda editar). */
export async function patchItems(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  input: ItemsPatchInput
): Promise<ServiceResult<{ moved: number | null } | { note: string | null }>> {
  if (!mixedListsEnabled()) return failure('not_found', { message: LIST_ERRORS.notAvailable })
  const access = await getListAccess(listId, userId)
  if (!access.exists) return failure('not_found', { message: 'List not found' })
  if (!access.canEdit) return failure('forbidden')

  if ('order' in input) {
    // Una sentencia (`reorder_list_items`, SECURITY INVOKER).
    const { data, error } = await supabase.rpc('reorder_list_items', { p_list: listId, p_items: input.order })
    if (error) {
      log.error('reorder failed', { listId, code: error.code, message: error.message })
      return failure('internal', { message: 'Failed to reorder' })
    }
    return success({ moved: typeof data === 'number' ? data : null })
  }

  const { error, count } = await supabase
    .from('list_items')
    .update({ note: input.note }, { count: 'exact' })
    .eq('id', input.itemId)
    .eq('list_id', listId)
  if (error) {
    log.error('note failed', { listId, code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to save note' })
  }
  if (count === 0) return failure('not_found', { message: 'Item not found' })
  return success({ note: input.note })
}

// ── /api/lists/[id]/members ──────────────────────────────────────────────────

/** Invita a un amigo a una lista colaborativa (solo el dueño) y le avisa. */
export async function inviteMember(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  targetUserId: string
): Promise<ServiceResult<null>> {
  if (targetUserId === userId) return failure('invalid_input', { field: 'userId', message: 'Cannot invite yourself' })

  const owner = await requireOwner(supabase, listId, userId)
  if (!owner.ok) return owner
  if (!owner.value.is_collaborative) {
    return failure('invalid_input', { message: LIST_ERRORS.notCollaborative })
  }

  const [{ data: target }, { data: senderProfile }, { data: friendship }] = await Promise.all([
    supabase.from('users').select('id').eq('id', targetUserId).maybeSingle(),
    supabase.from('users').select('username').eq('id', userId).maybeSingle(),
    // La RLS de list_members (20261023020001) solo deja añadir a AMIGOS: se
    // comprueba antes para responder `forbidden` con motivo en vez de un 500.
    supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${userId},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${userId})`
      )
      .limit(1)
      .maybeSingle(),
  ])
  if (!target) return failure('not_found', { field: 'userId', message: 'User not found' })
  if (!friendship) return failure('forbidden', { message: LIST_ERRORS.notFriends })

  const { error } = await supabase
    .from('list_members')
    .upsert({ list_id: listId, user_id: targetUserId }, { onConflict: 'list_id,user_id', ignoreDuplicates: true })
  if (error) {
    // La amistad pudo romperse entre la comprobación y el alta (o un bloqueo).
    if (error.code === '42501') return failure('forbidden', { message: LIST_ERRORS.notFriends })
    log.error('invite failed', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to add member' })
  }

  // Notificación vía admin client (notifications no tiene policy INSERT para anon).
  const admin = createAdminClient()
  const username = (senderProfile as { username?: string } | null)?.username ?? ''
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: targetUserId,
    type: 'list_invite',
    payload: { listId, listName: owner.value.name, fromUserId: userId, fromUsername: username },
  })
  if (notifErr) log.error('[E83] notif insert failed', { type: 'list_invite', notifErr })
  return success(null)
}

/** Quita a un miembro (el dueño) o sale de la lista (el propio miembro). */
export async function removeMember(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  targetUserId: string
): Promise<ServiceResult<null>> {
  const { data } = await supabase.from('lists').select('owner_id').eq('id', listId).maybeSingle()
  const list = data as { owner_id: string } | null
  if (!list) return failure('not_found', { message: 'List not found' })
  if (list.owner_id !== userId && targetUserId !== userId) return failure('forbidden')

  const { error } = await supabase.from('list_members').delete().eq('list_id', listId).eq('user_id', targetUserId)
  if (error) {
    log.error('remove member failed', { listId, code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to remove member' })
  }
  return success(null)
}
