// ============================================================
// KULTURA — /api/chat
// GET: lista de conversaciones del usuario
// POST: crear/obtener conversación con un amigo
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Conversations where user is a member, with last message + other member info
  const { data } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      last_read_at,
      conversations(id, last_message_at)
    `)
    .eq('user_id', user.id)
    .order('conversations(last_message_at)', { ascending: false })

  if (!data) return NextResponse.json({ conversations: [] })

  // For each conversation, get the other member's profile + last message
  const enriched = await Promise.all(
    (data as unknown as Array<{
      conversation_id: string
      last_read_at: string | null
      conversations: { id: string; last_message_at: string } | null
    }>).map(async (row) => {
      const convId = row.conversation_id

      const [membersResult, lastMsgResult] = await Promise.all([
        supabase
          .from('conversation_members')
          .select('user_id, users(id, username, avatar_color, avatar_initials)')
          .eq('conversation_id', convId)
          .neq('user_id', user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('content, sender_id, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const otherMember = (membersResult.data as {
        user_id: string
        users: { id: string; username: string; avatar_color: string; avatar_initials: string } | null
      } | null)?.users ?? null

      const lastMsg = lastMsgResult.data
      const unread = lastMsg && row.last_read_at
        ? new Date(lastMsg.created_at) > new Date(row.last_read_at)
        : !!lastMsg

      return {
        id: convId,
        lastMessageAt: row.conversations?.last_message_at ?? null,
        otherUser: otherMember,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          isMine: lastMsg.sender_id === user.id,
        } : null,
        unread,
      }
    })
  )

  return NextResponse.json({ conversations: enriched })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`chat_create:${user.id}`, LIMITS.chat_create)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const { targetUserId } = await req.json().catch(() => ({}))
  if (!targetUserId) return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 })

  const { data: conversationId, error: rpcError } = await supabase.rpc(
    'create_conversation_with_members',
    { target_user_id: targetUserId },
  )

  // E93: DMs solo entre amigos. El RPC lanza 'not_friends' (P0005) si
  // caller y target no son amigos aceptados → 403, no 500 genérico.
  if (rpcError?.message === 'not_friends' || rpcError?.code === 'P0005') {
    return NextResponse.json({ error: 'not_friends' }, { status: 403 })
  }

  if (rpcError || !conversationId) {
    console.error('Failed to create conversation:', { rpcError, userId: user.id, targetUserId })
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversationId }, { status: 201 })
}
