// ============================================================
// KULTURA — /friends (Server Component)
// Lista de amigos + solicitudes pendientes + share link.
// Requiere autenticación.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFriends, getPendingRequests } from '@/lib/social/friends'
import { FriendsClient } from './FriendsClient'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Amigos · KULTURA' }
}

export default async function FriendsPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const t = await getTranslations('friends')

  // Obtener perfil del usuario (para share link)
  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const [friends, pendingRequests] = await Promise.all([
    getFriends(user.id),
    getPendingRequests(user.id),
  ])

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const profileUrl = profile
    ? `${baseUrl}/profile/${profile.username}`
    : baseUrl

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
      <h1 className="font-display text-3xl mb-8">{t('title')}</h1>
      <FriendsClient
        friends={friends}
        pendingRequests={pendingRequests}
        profileUrl={profileUrl}
      />
    </main>
  )
}
