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
    <main className="max-w-3xl mx-auto px-4 md:px-14 pt-2 pb-14">
      <div className="flex items-center justify-between gap-4 mb-7">
        <h1 className="font-display text-[34px] md:text-[42px] font-bold text-text-primary">
          {t('title')} <span aria-hidden="true">👥</span>
        </h1>
        <a
          href="#buscar"
          className="hidden sm:inline-flex items-center rounded-pill bg-accent-pink text-on-accent-pink font-extrabold text-sm px-6 py-3.5 hover:brightness-110 transition-all"
        >
          + {t('addFriend')}
        </a>
      </div>
      <FriendsClient
        friends={friends}
        pendingRequests={pendingRequests}
        profileUrl={profileUrl}
      />
    </main>
  )
}
