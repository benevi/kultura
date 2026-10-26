// ============================================================
// KULTURA — Route Handler: /api/lists/[id]
// Gestiona items y miembros de una lista.
//
// POST   body { mediaId }                        → añadir item (mediaCache se ignora)
// POST   body { userId }  x-action: invite       → añadir miembro (solo amigos)
// DELETE body { itemId }                         → eliminar item
// DELETE body { userId }  x-action: remove-member → eliminar miembro
// PATCH  body { isPublic?, name?, description? } → datos de la lista (solo owner)
// PATCH  body { order: itemId[] }                → orden manual (F-25, editores)
// PATCH  body { itemId, note }                   → nota de un título (F-25, editores)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics/track'
import { createAdminClient } from '@/lib/supabase/admin'
import { canEditList, getListAccess } from '@/lib/social/lists'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { upsertMediaFromProvider, mediaFailureStatus } from '@/lib/media/upsert-from-provider'
import { localeFromRequest } from '@/lib/media/request-locale'
import {
  LIST_DESCRIPTION_MAX,
  LIST_NAME_MAX,
  LIST_NOTE_MAX,
  LIST_REORDER_MAX,
  fitsList,
  isNotMigrated,
  isUuid,
  mixedListsEnabled,
  optionalText,
} from '../shared'

const log = createLogger('api/lists')

interface Params {
  params: Promise<{ id: string }>
}

/** Texto para quien llame a la API sin la interfaz (la interfaz traduce el código). */
const NOT_FRIENDS_MESSAGE = 'Only friends can be invited to a list.'

/** POST /api/lists/[id] */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id: listId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const action = request.headers.get('x-action')

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Invitar miembro ─────────────────────────────────────────────────────────
  if (action === 'invite') {
    const targetUserId = body.userId
    if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!isUuid(targetUserId)) {
      return NextResponse.json({ error: 'userId must be a uuid' }, { status: 400 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
    }

    // Solo el owner puede invitar
    const { data: list } = await supabase
      .from('lists')
      .select('owner_id, is_collaborative, name')
      .eq('id', listId)
      .maybeSingle()

    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
    if (list.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!list.is_collaborative) {
      return NextResponse.json({ error: 'List is not collaborative' }, { status: 400 })
    }

    // Verificar que el usuario objetivo existe y obtener username del remitente
    const [{ data: target }, { data: senderProfile }, { data: friendship }] = await Promise.all([
      supabase.from('users').select('id').eq('id', targetUserId).maybeSingle(),
      supabase.from('users').select('username').eq('id', user.id).maybeSingle(),
      // La RLS de list_members (20261023020001) solo deja añadir a AMIGOS: se
      // comprueba antes para responder 403 con motivo en vez de un 500.
      supabase
        .from('friendships')
        .select('id')
        .eq('status', 'accepted')
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${user.id})`
        )
        .limit(1)
        .maybeSingle(),
    ])
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!friendship) {
      return NextResponse.json({ error: 'not_friends', message: NOT_FRIENDS_MESSAGE }, { status: 403 })
    }

    // Insertar miembro (ignorar si ya existe)
    const { error: insertErr } = await supabase
      .from('list_members')
      .upsert({ list_id: listId, user_id: targetUserId }, { onConflict: 'list_id,user_id', ignoreDuplicates: true })

    if (insertErr) {
      // La amistad pudo romperse entre la comprobación y el alta (o un bloqueo).
      if (insertErr.code === '42501') {
        return NextResponse.json({ error: 'not_friends', message: NOT_FRIENDS_MESSAGE }, { status: 403 })
      }
      log.error('invite failed', { code: insertErr.code, message: insertErr.message })
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    // Notificación vía admin client (notifications no tiene policy INSERT para anon)
    const admin = createAdminClient()
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: targetUserId,
      type: 'list_invite',
      payload: { listId, listName: list.name, fromUserId: user.id, fromUsername: senderProfile?.username ?? '' },
    })
    if (notifErr) log.error('[E83] notif insert failed', { type: 'list_invite', notifErr })

    return NextResponse.json({ ok: true }, { status: 201 })
  }

  // ── Añadir item ─────────────────────────────────────────────────────────────
  const mediaId = body.mediaId as string | undefined
  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
  }
  if (typeof mediaId !== 'string' || !/^[a-z]+_.+$/.test(mediaId)) {
    return NextResponse.json({ error: 'mediaId must follow the format "{type}_{externalId}"' }, { status: 400 })
  }

  const access = await getListAccess(listId, user.id)
  if (!access.canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Una lista de un formato solo admite ese formato; la mixta, todos.
  if (access.mediaType && !fitsList(access.mediaType, mediaId)) {
    return NextResponse.json({ error: 'type_mismatch' }, { status: 400 })
  }

  // Evitar duplicados en la lista
  const { data: existing } = await supabase
    .from('list_items')
    .select('id')
    .eq('list_id', listId)
    .eq('media_id', mediaId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Item already in list' }, { status: 409 })
  }

  // La fila de `media` (FK de list_items) la garantiza el servidor con la
  // ficha del proveedor; `mediaCache` se ignora (SEG-2).
  const media = await upsertMediaFromProvider(mediaId, { locale: localeFromRequest(request) })
  if (!media.ok) {
    const failure = mediaFailureStatus(media.reason)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }

  // El RETURNING de list_items sí pasa la RLS: la lista ya existe y
  // can_read_list la ve. El disparador de F-25 pone `position` al final.
  const { data: item, error: itemErr } = await supabase
    .from('list_items')
    .insert({ list_id: listId, media_id: mediaId, added_by: user.id })
    .select('id, list_id, media_id, added_by, added_at')
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }

  return NextResponse.json({ item }, { status: 201 })
}

/** DELETE /api/lists/[id] */
export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id: listId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const action = request.headers.get('x-action')

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Eliminar miembro ────────────────────────────────────────────────────────
  if (action === 'remove-member') {
    const targetUserId = body.userId as string | undefined
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: list } = await supabase
      .from('lists')
      .select('owner_id')
      .eq('id', listId)
      .maybeSingle()

    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
    // Solo el owner puede eliminar miembros (o el propio miembro saliendo)
    if (list.owner_id !== user.id && targetUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', targetUserId)

    return NextResponse.json({ ok: true })
  }

  // ── Eliminar item ───────────────────────────────────────────────────────────
  const itemId = body.itemId as string | undefined
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
  }

  const allowed = await canEditList(listId, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteErr, count } = await supabase
    .from('list_items')
    .delete({ count: 'exact' })
    .eq('id', itemId)
    .eq('list_id', listId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
  }

  // 404 si no existía
  if (count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

/** PATCH /api/lists/[id] — datos de la lista, orden manual o nota de un título */
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id: listId } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Orden manual y notas (F-25): cualquiera que pueda editar ────────────────
  if ('order' in body || 'note' in body) {
    if (!mixedListsEnabled()) {
      return NextResponse.json({ error: 'not_available' }, { status: 404 })
    }
    const access = await getListAccess(listId, user.id)
    if (!access.exists) return NextResponse.json({ error: 'List not found' }, { status: 404 })
    if (!access.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return 'order' in body
      ? saveOrder(supabase, listId, body.order)
      : saveNote(supabase, listId, body.itemId, body.note)
  }

  // ── Datos de la lista: solo el dueño ────────────────────────────────────────
  const update: Record<string, unknown> = {}
  if ('isPublic' in body) {
    if (typeof body.isPublic !== 'boolean') {
      return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
    }
    update.is_public = body.isPublic
  }
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length === 0 || name.length > LIST_NAME_MAX) {
      return NextResponse.json({ error: `name must be 1-${LIST_NAME_MAX} characters` }, { status: 400 })
    }
    update.name = name
  }
  if ('description' in body && mixedListsEnabled()) {
    const description = optionalText(body.description, LIST_DESCRIPTION_MAX)
    if (!description.ok) {
      return NextResponse.json({ error: `description must be at most ${LIST_DESCRIPTION_MAX} characters` }, { status: 400 })
    }
    update.description = description.value ?? null
  }
  if (Object.keys(update).length === 0) {
    // Compatibilidad: el cuerpo de siempre era { isPublic } y sin él es un 400.
    return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
  }

  const { data: list } = await supabase
    .from('lists')
    .select('owner_id')
    .eq('id', listId)
    .maybeSingle()

  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  // Un miembro de una colaborativa puede editar títulos, pero publicar es del dueño
  if (list.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateErr } = await supabase
    .from('lists')
    .update(update)
    .eq('id', listId)
    .eq('owner_id', user.id)

  if (updateErr) {
    if (isNotMigrated(updateErr)) return NextResponse.json({ error: 'not_available' }, { status: 409 })
    log.error('PATCH list failed', { listId, message: updateErr.message })
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
  }

  // D-12: primera vez que esta lista se hace pública (una vez por lista).
  if (update.is_public === true) {
    await track(user, 'list_made_public', {}, { dedupeKey: `list_made_public:${listId}` })
  }

  return NextResponse.json({
    ok: true,
    ...('is_public' in update ? { isPublic: update.is_public } : {}),
    ...('name' in update ? { name: update.name } : {}),
    ...('description' in update ? { description: update.description } : {}),
  })
}

type Client = Awaited<ReturnType<typeof createClient>>

/** Orden completo en una sentencia (`reorder_list_items`, SECURITY INVOKER). */
async function saveOrder(supabase: Client, listId: string, order: unknown): Promise<NextResponse> {
  if (!Array.isArray(order) || order.length === 0 || order.length > LIST_REORDER_MAX || !order.every(isUuid)) {
    return NextResponse.json({ error: `order must be 1-${LIST_REORDER_MAX} item ids` }, { status: 400 })
  }
  if (new Set(order).size !== order.length) {
    return NextResponse.json({ error: 'order has duplicates' }, { status: 400 })
  }
  const { data, error } = await supabase.rpc('reorder_list_items', { p_list: listId, p_items: order })
  if (error) {
    if (isNotMigrated(error)) return NextResponse.json({ error: 'not_available' }, { status: 409 })
    log.error('reorder failed', { listId, code: error.code, message: error.message })
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, moved: typeof data === 'number' ? data : null })
}

async function saveNote(supabase: Client, listId: string, itemId: unknown, note: unknown): Promise<NextResponse> {
  if (!isUuid(itemId)) return NextResponse.json({ error: 'itemId must be a uuid' }, { status: 400 })
  const text = optionalText(note, LIST_NOTE_MAX)
  if (!text.ok || text.value === undefined) {
    return NextResponse.json({ error: `note must be a string of at most ${LIST_NOTE_MAX} characters or null` }, { status: 400 })
  }
  const { error, count } = await supabase
    .from('list_items')
    .update({ note: text.value }, { count: 'exact' })
    .eq('id', itemId)
    .eq('list_id', listId)
  if (error) {
    if (isNotMigrated(error)) return NextResponse.json({ error: 'not_available' }, { status: 409 })
    log.error('note failed', { listId, code: error.code, message: error.message })
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  }
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, note: text.value })
}
