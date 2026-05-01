// ============================================================
// KULTURA — ProfilePage (Server Component)
// Página pública de perfil de usuario: header con stats,
// secciones de biblioteca reciente y estadísticas detalladas.
// ============================================================

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserStats } from '@/lib/library/stats'
import { getRecentLibraryByStatus } from '@/lib/library/queries'
import { getFriendshipStatus } from '@/lib/social/friends'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileStats } from '@/components/profile/ProfileStats'
import { ProfileGenres } from '@/components/profile/ProfileGenres'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import { ReportButton } from '@/components/social/ReportButton'
import { MediaRow } from '@/components/home/MediaRow'
import type { DbFriendship } from '@/types/supabase'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string; username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const title = `${username} · KULTURA`
  const description = `Perfil de ${username} en KULTURA — biblioteca personal de películas, series, libros y más.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = createClient()
  const t = await getTranslations('profile')

  // Perfil del usuario visitado
  const { data: profileUser } = await supabase
    .from('users')
    .select('id, username, avatar_color, avatar_initials, created_at, bio')
    .eq('username', username)
    .single()

  if (!profileUser) notFound()

  // Usuario autenticado (puede ser null si no hay sesión)
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Estado de amistad (solo si hay usuario autenticado y no es el propio perfil)
  const isOwnProfile = currentUser?.id === profileUser.id
  let friendshipStatus: import('@/lib/social/friends').FriendshipStatusResult = 'none'
  let friendshipId: string | undefined

  if (currentUser && !isOwnProfile) {
    friendshipStatus = await getFriendshipStatus(currentUser.id, profileUser.id)

    if (friendshipStatus !== 'none') {
      const { data: row } = await supabase
        .from('friendships')
        .select('id')
        .or(
          `and(requester_id.eq.${currentUser.id},receiver_id.eq.${profileUser.id}),and(requester_id.eq.${profileUser.id},receiver_id.eq.${currentUser.id})`
        )
        .maybeSingle()
      friendshipId = (row as Pick<DbFriendship, 'id'> | null)?.id
    }
  }

  const [stats, recentCompleted, recentInProgress] = await Promise.all([
    getUserStats(profileUser.id),
    getRecentLibraryByStatus(profileUser.id, 'completed', 8),
    getRecentLibraryByStatus(profileUser.id, 'in_progress', 8),
  ])

  const completedItems = recentCompleted.map(entry => ({
    mediaId: entry.mediaId,
    title: entry.title ?? '',
    poster: entry.poster ?? null,
    type: entry.mediaId.split('_')[0],
  }))

  const inProgressItems = recentInProgress.map(entry => ({
    mediaId: entry.mediaId,
    title: entry.title ?? '',
    poster: entry.poster ?? null,
    type: entry.mediaId.split('_')[0],
  }))

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-10">
      {/* Header de perfil */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <ProfileHeader
            userId={profileUser.id}
            username={profileUser.username}
            avatarColor={profileUser.avatar_color}
            avatarInitials={profileUser.avatar_initials}
            createdAt={profileUser.created_at}
            bio={(profileUser as { bio?: string | null }).bio ?? null}
            isOwner={isOwnProfile}
            totalItems={stats.totalItems}
            totalCompleted={stats.totalCompleted}
            totalInProgress={stats.totalInProgress}
          />
        </div>
        {currentUser && !isOwnProfile && (
          <div className="flex-shrink-0 flex flex-col items-end gap-2 md:mt-0 mt-0">
            <FriendshipButton
              initialStatus={friendshipStatus}
              targetUserId={profileUser.id}
              friendshipId={friendshipId}
            />
            <ReportButton targetType="user" targetId={profileUser.id} />
          </div>
        )}
        {isOwnProfile && (
          <a
            href="/settings"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm text-muted border border-border rounded-md px-3 py-1.5 hover:text-text hover:border-muted transition-colors"
          >
            {t('editProfile')}
          </a>
        )}
      </div>

      {/* Últimos completados */}
      {completedItems.length > 0 && (
        <MediaRow title={t('lastCompleted')} items={completedItems} />
      )}

      {/* Viendo ahora */}
      {inProgressItems.length > 0 && (
        <MediaRow title={t('watchingNow')} items={inProgressItems} />
      )}

      {/* Estadísticas detalladas */}
      <ProfileStats byType={stats.byType} totalItems={stats.totalItems} />

      {/* Géneros favoritos */}
      <ProfileGenres topGenres={stats.topGenres} />
    </main>
  )
}
