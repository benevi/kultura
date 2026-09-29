// ============================================================
// KULTURA — /chat (Server Component)
// Lista de conversaciones del usuario
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getFriends } from '@/lib/social/friends'
import { ChatClient } from './ChatClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chat')
  return { title: `${t('title')} · KULTURA` }
}

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('chat')

  // Get friends to populate "new chat" picker
  const friendships = await getFriends(user.id)
  const friends = friendships
    .filter(f => f.otherUser)
    .map(f => ({
      id: f.otherUser!.id,
      username: f.otherUser!.username,
      avatar_color: f.otherUser!.avatarColor,
      avatar_initials: f.otherUser!.avatarInitials,
    }))

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-14 pt-2 pb-14">
      <h1 className="font-display text-[34px] md:text-[42px] font-bold text-text-primary mb-6">
        {t('title')} <span aria-hidden="true">💬</span>
      </h1>
      <ChatClient friends={friends} />
    </main>
  )
}
