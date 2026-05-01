// ============================================================
// KULTURA — Route Handler: /api/friends
// Gestiona el sistema de amistades del usuario autenticado.
// GET:    lista de amigos aceptados (para RecommendModal)
// POST:   enviar solicitud de amistad
// PATCH:  aceptar o rechazar una solicitud
// DELETE: eliminar una amistad existente
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

/** GET /api/friends — lista de amigos aceptados del usuario autenticado */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, receiver_id, requester:requester_id(id, username, avatar_color, avatar_initials), receiver:receiver_id(id, username, avatar_color, avatar_initials)'
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 })
  }

  type FriendRow = {
    id: string
    requester_id: string
    receiver_id: string
    requester: { id: string; username: string; avatar_color: string; avatar_initials: string } | null
    receiver: { id: string; username: string; avatar_color: string; avatar_initials: string } | null
  }

  // Mapear para devolver solo el perfil del otro usuario
  const friends = (data as unknown as FriendRow[]).map((row) => {
    const isRequester = row.requester_id === user.id
    return {
      friendshipId: row.id,
      user: isRequester ? row.receiver : row.requester,
    }
  }).filter((f): f is { friendshipId: string; user: NonNullable<FriendRow['requester']> } => f.user !== null)

  return NextResponse.json({ friends })
}

/** POST /api/friends — enviar solicitud de amistad */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limiting — 10 req/min por usuario
  const rl = checkRateLimit(`${user.id}:friends`, LIMITS.friends)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { receiverId?: string }
  try {
    body = await request.json() as { receiverId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.receiverId) {
    return NextResponse.json({ error: 'receiverId is required' }, { status: 400 })
  }

  if (body.receiverId === user.id) {
    return NextResponse.json(
      { error: 'Cannot send friend request to yourself' },
      { status: 400 }
    )
  }

  // Verificar que el receptor existe
  const { data: receiver } = await supabase
    .from('users')
    .select('id')
    .eq('id', body.receiverId)
    .maybeSingle()

  if (!receiver) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Verificar que no existe ya una relación (en cualquier dirección)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${body.receiverId}),and(requester_id.eq.${body.receiverId},receiver_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Friendship already exists' },
      { status: 409 }
    )
  }

  const { data, error: insertError } = await supabase
    .from('friendships')
    .insert({
      requester_id: user.id,
      receiver_id: body.receiverId,
      status: 'pending',
    })
    .select('id, requester_id, receiver_id, status, created_at')
    .single()

  if (insertError || !data) {
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 })
  }

  return NextResponse.json({ friendship: data }, { status: 201 })
}

/** PATCH /api/friends — aceptar o rechazar solicitud */
export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { friendshipId?: string; action?: string }
  try {
    body = await request.json() as { friendshipId?: string; action?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.friendshipId) {
    return NextResponse.json({ error: 'friendshipId is required' }, { status: 400 })
  }

  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json(
      { error: 'action must be "accept" or "decline"' },
      { status: 400 }
    )
  }

  // Solo el receptor puede aceptar o rechazar
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id, receiver_id, status')
    .eq('id', body.friendshipId)
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
  }

  if (friendship.receiver_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (friendship.status !== 'pending') {
    return NextResponse.json({ error: 'Friendship is not pending' }, { status: 409 })
  }

  if (body.action === 'decline') {
    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', body.friendshipId)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // accept
  const { data, error: updateError } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', body.friendshipId)
    .select('id, requester_id, receiver_id, status, created_at')
    .single()

  if (updateError || !data) {
    return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 })
  }

  return NextResponse.json({ friendship: data })
}

/** DELETE /api/friends — eliminar amistad */
export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { friendshipId?: string }
  try {
    body = await request.json() as { friendshipId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.friendshipId) {
    return NextResponse.json({ error: 'friendshipId is required' }, { status: 400 })
  }

  // Solo participantes pueden eliminar
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id')
    .eq('id', body.friendshipId)
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
  }

  if (friendship.requester_id !== user.id && friendship.receiver_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('friendships')
    .delete()
    .eq('id', body.friendshipId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
