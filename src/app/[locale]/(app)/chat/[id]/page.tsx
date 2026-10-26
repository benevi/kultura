// ============================================================
// KULTURA — /chat/[id] (Server Component)
// Vista de conversación individual con mensajes
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConversationClient } from './ConversationClient'
import { isModerationV2 } from '@/lib/social/friends'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Chat' }
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify membership
  const { data: member } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  // Get other member's info
  const { data: otherMember } = await supabase
    .from('conversation_members')
    .select('user_id, users(id, username, avatar_color, avatar_initials)')
    .eq('conversation_id', id)
    .neq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const otherUser = (otherMember as {
    user_id: string
    users: { id: string; username: string; avatar_color: string; avatar_initials: string } | null
  } | null)?.users ?? null

  // F-11: ¿se puede escribir? (amistad vigente y sin bloqueo). Solo con la
  // bandera; si la función aún no existe, se deja escribir y decide la base.
  const moderation = isModerationV2()
  let canSend = true
  if (moderation) {
    const { data, error } = await supabase.rpc('can_send_message', { p_conversation_id: id })
    if (!error && typeof data === 'boolean') canSend = data
  }

  return (
    <main className="page-grid max-md:px-0 [&>*]:max-w-2xl">
      <ConversationClient
        conversationId={id}
        otherUser={otherUser}
        currentUserId={user.id}
        moderation={moderation}
        canSend={canSend}
      />
    </main>
  )
}
