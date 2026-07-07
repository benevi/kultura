// ============================================================
// KULTURA — /api/chat/[id]
// GET: mensajes de una conversación
// POST: enviar mensaje
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabase = createClient()
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

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  // Fetch messages with sender info
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content, sender_id, created_at, users(username, avatar_color, avatar_initials)')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(100)

  // Mark as read
  supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .then(() => {})

  return NextResponse.json({ messages: messages ?? [], currentUserId: user.id })
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params
  const supabase = createClient()
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

  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 })

  return NextResponse.json({ message: msg }, { status: 201 })
}
