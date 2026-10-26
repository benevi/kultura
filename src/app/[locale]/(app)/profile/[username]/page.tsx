// ============================================================
// KULTURA — ProfilePage (Server Component)
// Página pública de perfil de usuario: header con stats,
// secciones de biblioteca reciente y estadísticas detalladas.
// ============================================================

import { notFound, permanentRedirect } from 'next/navigation'
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
import { ShareLinkButton } from '@/components/social/ShareLinkButton'
import { hasPublicLists, resolveRenamedUsername } from '@/lib/social/public-collection'
import { MediaRow } from '@/components/home/MediaRow'
import { KButton } from '@/components/ui/KButton'
import { Link } from '@/i18n/navigation'
import { IconLibrary } from '@/components/icons'
import { isNotMigrated } from '@/app/api/settings/account-state'
import type { DbFriendship } from '@/types/supabase'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string; username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username: raw } = await params
  const username = decodeURIComponent(raw)
  const t = await getTranslations({ locale, namespace: 'profile' })
  const title = username
  const ogTitle = `${username} · KULTURA`
  const description = t('metaDescription', { username })
  return {
    title,
    description,
    openGraph: { title: ogTitle, description, type: 'profile' },
    twitter: { card: 'summary', title: ogTitle, description },
  }
}

/**
 * ¿Puede el visitante ver la biblioteca de `ownerId`? (D-04b). La base ya lo
 * impone con RLS; esto es para enseñar "biblioteca privada" en vez de un
 * "aún no tiene actividad" que sería mentira. Sin la migración, sí (rige la
 * política de W1: cualquiera con sesión).
 */
async function canReadLibrary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_read_library', { p_owner: ownerId })
  if (error) return isNotMigrated(error) ? true : false
  return data === true
}

export default async function ProfilePage({ params }: Props) {
  const { locale, username: raw } = await params
  const username = decodeURIComponent(raw)
  const supabase = await createClient()
  const t = await getTranslations('profile')
  const tc = await getTranslations('collection')

  // Perfil del usuario visitado
  const { data: profileUser } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (!profileUser) {
    // R11: un nombre antiguo redirige (308) al actual. Sin la migración, la
    // función no existe y es un 404 normal.
    const current = await resolveRenamedUsername(username)
    if (current) permanentRedirect(`/${locale}/profile/${encodeURIComponent(current)}`)
    notFound()
  }

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

  const libraryVisible = isOwnProfile || (await canReadLibrary(supabase, profileUser.id))
  const visibility = (profileUser as { library_visibility?: string }).library_visibility

  const EMPTY_STATS = { totalItems: 0, totalCompleted: 0, totalInProgress: 0, byType: [], topGenres: [] }
  const [stats, recentCompleted, recentInProgress, recentPending, canShareCollection] = await Promise.all([
    // Biblioteca oculta (D-04b): ni se consulta (la RLS devolvería 0 filas).
    libraryVisible ? getUserStats(profileUser.id) : Promise.resolve(EMPTY_STATS),
    libraryVisible ? getRecentLibraryByStatus(profileUser.id, 'completed', 8) : Promise.resolve([]),
    libraryVisible ? getRecentLibraryByStatus(profileUser.id, 'in_progress', 8) : Promise.resolve([]),
    libraryVisible ? getRecentLibraryByStatus(profileUser.id, 'pending', 8) : Promise.resolve([]),
    // Solo el dueño ve el botón; para el resto ni se consulta.
    isOwnProfile ? hasPublicLists(profileUser.id) : Promise.resolve(false),
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

  const pendingItems = recentPending.map(entry => ({
    mediaId: entry.mediaId,
    title: entry.title ?? '',
    poster: entry.poster ?? null,
    type: entry.mediaId.split('_')[0],
  }))

  const hasAnyContent = completedItems.length > 0 || inProgressItems.length > 0 || pendingItems.length > 0

  return (
    <main className="page-grid [&>*]:max-w-4xl py-8 flex flex-col gap-10">
      {/* Header de perfil */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <ProfileHeader
            userId={profileUser.id}
            username={profileUser.username}
            avatarColor={profileUser.avatar_color}
            avatarInitials={profileUser.avatar_initials}
            avatarIcon={profileUser.avatar_icon ?? null}
            createdAt={profileUser.created_at}
            bio={(profileUser as { bio?: string | null }).bio ?? null}
            isOwner={isOwnProfile}
            totalItems={stats.totalItems}
            totalCompleted={stats.totalCompleted}
            totalInProgress={stats.totalInProgress}
            showCounters={libraryVisible}
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
          <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
            {canShareCollection && (
              <ShareLinkButton
                path={`/u/${profileUser.username}`}
                title={tc('heading', { username: profileUser.username })}
                label={tc('shareCollection')}
              />
            )}
            <KButton asChild variant="secondary" size="sm">
              <Link href="/settings">{t('editProfile')}</Link>
            </KButton>
          </div>
        )}
      </div>

      {/* Viendo ahora */}
      {inProgressItems.length > 0 && (
        <MediaRow title={t('watchingNow')} items={inProgressItems} requirePoster={false} />
      )}

      {/* Últimos completados */}
      {completedItems.length > 0 && (
        <MediaRow title={t('lastCompleted')} items={completedItems} requirePoster={false} />
      )}

      {/* Pendientes */}
      {pendingItems.length > 0 && (
        <MediaRow title={t('pendingRow')} items={pendingItems} requirePoster={false} />
      )}

      {/* Biblioteca oculta por su dueño (D-04b) */}
      {!libraryVisible && (
        <div className="flex flex-col items-center gap-3 rounded-bento bg-surface-default px-6 py-14 text-center">
          <IconLibrary className="w-12 h-12 text-text-tertiary" />
          <p className="font-bold text-text-primary">
            {t('libraryHidden', { username: profileUser.username })}
          </p>
          <p className="max-w-sm text-sm text-text-tertiary">
            {visibility === 'friends' ? t('libraryHiddenFriends') : t('libraryHiddenPrivate')}
          </p>
        </div>
      )}

      {/* Empty state cuando la biblioteca está vacía */}
      {libraryVisible && !hasAnyContent && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconLibrary className="w-12 h-12 text-text-tertiary" />
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
            {isOwnProfile
              ? t('emptyOwn')
              : t('emptyOther', { username: profileUser.username })}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {isOwnProfile ? t('emptyOwnHint') : t('emptyOtherHint')}
          </p>
        </div>
      )}

      {libraryVisible && (
        <>
          {/* Estadísticas detalladas */}
          <ProfileStats byType={stats.byType} totalItems={stats.totalItems} />

          {/* Géneros favoritos */}
          <ProfileGenres topGenres={stats.topGenres} />
        </>
      )}
    </main>
  )
}
