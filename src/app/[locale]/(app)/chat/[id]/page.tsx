// ============================================================
// KULTURA — /chat/[id] (Server Component)
// Vista de conversación individual con mensajes
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ConversationClient } from './ConversationClient'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Chat · KULTURA' }
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

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

  return (
    <main className="max-w-2xl mx-auto px-0 md:px-4">
      <ConversationClient
        conversationId={id}
        otherUser={otherUser}
        currentUserId={user.id}
      />
    </main>
  )
}
