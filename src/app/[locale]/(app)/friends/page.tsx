// ============================================================
// KULTURA — /friends (Server Component)
// Lista de amigos + solicitudes pendientes + enlace de invitación.
// Requiere autenticación.
//
// CRE-7: el enlace que se comparte es la invitación firmada al perfil
// público (`/{locale}/u/{username}?ref={username}&inv={firma}`), que abre sin
// sesión; quien se registra con él queda como amigo. Antes apuntaba a
// `/profile/{username}`, que exige sesión y no llevaba idioma.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { PageHeading } from '@/components/layout/PageHeading'
import { redirect } from 'next/navigation'
import { getFriends, getPendingRequests } from '@/lib/social/friends'
import { inviteUrl } from '@/lib/analytics/invite'
import { siteUrl } from '@/lib/site-url'
import { FriendsClient } from './FriendsClient'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'friends' })
  return { title: t('title') }
}

export default async function FriendsPage({ params }: Props) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/friends`)}`)

  const t = await getTranslations('friends')

  // Perfil del usuario (para el enlace de invitación)
  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const [friends, pendingRequests] = await Promise.all([
    getFriends(user.id),
    getPendingRequests(user.id),
  ])

  const profileUrl = profile?.username
    ? inviteUrl(locale, { id: user.id, username: profile.username })
    : siteUrl()

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
      <PageHeading emoji="👥">{t('title')}</PageHeading>
      <FriendsClient
        friends={friends}
        pendingRequests={pendingRequests}
        profileUrl={profileUrl}
      />
    </main>
  )
}
