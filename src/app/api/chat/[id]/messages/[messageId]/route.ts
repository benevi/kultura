// ============================================================
// KULTURA — /api/chat/[id]/messages/[messageId] (F-11)
// DELETE: borrar un mensaje propio (con MODERATION_V2; la política
// "Senders can delete own messages" llega con la migración de moderación).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isModerationV2 } from '@/lib/social/friends'

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id, messageId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isModerationV2()) return NextResponse.json({ error: 'moderation_disabled' }, { status: 404 })

  const rl = checkRateLimit(`chat_delete:${user.id}`, LIMITS.chat_read)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // Filtro explícito por remitente además de la RLS: nunca se borra lo ajeno.
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('conversation_id', id)
    .eq('sender_id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
