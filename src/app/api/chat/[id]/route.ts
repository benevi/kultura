// ============================================================
// KULTURA — /api/chat/[id]
// GET: los últimos mensajes de una conversación (?before=ISO para los anteriores)
// POST: enviar mensaje
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isModerationV2, isRlsDenied } from '@/lib/social/friends'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Mensajes por página. */
const CHAT_PAGE_SIZE = 100

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`chat_read:${user.id}`, LIMITS.chat_read)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // Verify membership
  const { data: member } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  // Saneamiento 1.3: `?before=<created_at>` pide la página anterior.
  const beforeParam = req.nextUrl.searchParams.get('before')
  if (beforeParam !== null && Number.isNaN(Date.parse(beforeParam))) {
    return NextResponse.json({ error: 'Invalid before' }, { status: 400 })
  }

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  // Saneamiento 1.3: los ÚLTIMOS mensajes. Antes se pedían los 100 primeros en
  // orden ascendente, así que en una conversación larga no se veía lo nuevo.
  // Se pide uno de más para saber si quedan anteriores.
  let query = supabase
    .from('messages')
    .select('id, content, sender_id, created_at, users(username, avatar_color, avatar_initials)')
    .eq('conversation_id', id)
  if (beforeParam !== null) query = query.lt('created_at', beforeParam)
  const { data: rows, error } = await query
    .order('created_at', { ascending: false })
    .limit(CHAT_PAGE_SIZE + 1)

  if (error) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })

  const page = rows ?? []
  const hasMore = page.length > CHAT_PAGE_SIZE
  // De vuelta a orden cronológico para pintarlos.
  const messages = page.slice(0, CHAT_PAGE_SIZE).reverse()

  // Leído solo al abrir (no al pedir mensajes viejos).
  if (beforeParam === null) {
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .then(() => {})
  }

  return NextResponse.json({ messages, hasMore, currentUserId: user.id })
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`chat_message:${user.id}`, LIMITS.chat_message)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const { content } = await req.json().catch(() => ({}))
  if (!content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  // messages.content es TEXT sin constraint → tope de longitud aquí para evitar
  // abuso de almacenamiento / payloads gigantes.
  if (typeof content !== 'string' || content.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 })
  }

  // Verify membership
  const { data: member } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({ conversation_id: id, sender_id: user.id, content: content.trim() })
    .select('id, content, sender_id, created_at')
    .single()

  // F-11: la política de messages exige amistad vigente y ningún bloqueo con
  // el resto de miembros. Un rechazo de RLS es "ya no podéis escribiros", no
  // un fallo del servidor.
  if (isRlsDenied(error)) return NextResponse.json({ error: 'cannot_message' }, { status: 403 })
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 })

  return NextResponse.json({ message: msg }, { status: 201 })
}

/** DELETE /api/chat/[id] — salir de la conversación (F-11, con MODERATION_V2). */
export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isModerationV2()) return NextResponse.json({ error: 'moderation_disabled' }, { status: 404 })

  const rl = checkRateLimit(`chat_leave:${user.id}`, LIMITS.chat_create)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // DELETE … RETURNING: si la política aún no existe (sin migración) o no es
  // miembro, no se borra nada y se sabe por el array vacío.
  const { data, error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .select('conversation_id')

  if (error) return NextResponse.json({ error: 'leave_failed' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  return NextResponse.json({ ok: true })
}
