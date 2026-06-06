// ============================================================
// KULTURA — Route Handler: /api/lists/[id]
// Gestiona items y miembros de una lista.
//
// POST   body { mediaId, mediaCache? }           → añadir item
// POST   body { userId }  x-action: invite       → añadir miembro
// DELETE body { itemId }                         → eliminar item
// DELETE body { userId }  x-action: remove-member → eliminar miembro
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canEditList } from '@/lib/social/lists'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

interface Params {
  params: Promise<{ id: string }>
}

/** POST /api/lists/[id] */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const supabase = createClient()
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
    const targetUserId = body.userId as string | undefined
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
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
    const [{ data: target }, { data: senderProfile }] = await Promise.all([
      supabase.from('users').select('id').eq('id', targetUserId).maybeSingle(),
      supabase.from('users').select('username').eq('id', user.id).maybeSingle(),
    ])
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Insertar miembro (ignorar si ya existe)
    const { error: insertErr } = await supabase
      .from('list_members')
      .upsert({ list_id: listId, user_id: targetUserId }, { onConflict: 'list_id,user_id', ignoreDuplicates: true })

    if (insertErr) return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })

    // Notificación vía admin client (notifications no tiene policy INSERT para anon)
    const admin = createAdminClient()
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: targetUserId,
      type: 'list_invite',
      payload: { listId, listName: list.name, fromUserId: user.id, fromUsername: senderProfile?.username ?? '' },
    })
    if (notifErr) console.error('[E83] notif insert failed', { type: 'list_invite', notifErr })

    return NextResponse.json({ ok: true }, { status: 201 })
  }

  // ── Añadir item ─────────────────────────────────────────────────────────────
  const mediaId = body.mediaId as string | undefined
  if (!mediaId) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
  }
  if (!/^[a-z]+_.+$/.test(mediaId)) {
    return NextResponse.json({ error: 'mediaId must follow the format "{type}_{externalId}"' }, { status: 400 })
  }

  const allowed = await canEditList(listId, user.id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Upsert media cache si viene
  const mediaCache = body.mediaCache as Record<string, unknown> | undefined
  if (mediaCache) {
    await supabase.from('media').upsert(
      {
        id: mediaId,
        external_id: mediaCache.externalId,
        type: mediaCache.type,
        title: mediaCache.title,
        poster: mediaCache.poster ?? null,
        backdrop: mediaCache.backdrop ?? null,
        year: mediaCache.year ?? null,
        synopsis: mediaCache.synopsis ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
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
  const supabase = createClient()
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
