// ============================================================
// KULTURA — ProfilePage (Server Component, con sesión)
// El álbum de una persona abierto de noche: la tapa (avatar, nombre, bio y
// sus números), sus páginas por estado con la forma que da el álbum (en
// curso = cromos puestos con su tira; completados = pegados, brillantes en
// el 10/10; pendientes = huecos numerados; abandonados = esquina doblada)
// y su álbum por formato. Lo que no se puede ver (D-04b) se dice, no se
// rellena con ceros.
// ============================================================

import { Suspense } from 'react'
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
import { ProfileShelf, type ShelfItem } from '@/components/profile/ProfileShelf'
import { progressRatio, type LibraryEntryWithProgress } from '@/lib/library/progress'
import { FriendProfileActivity, FriendsActivitySkeleton } from '../../home/sections'
import { KButton } from '@/components/ui/KButton'
import { Link } from '@/i18n/navigation'
import { isNotMigrated } from '@/app/api/settings/account-state'
import type { DbFriendship } from '@/types/supabase'
import { getTranslations } from 'next-intl/server'
import { PushOffer } from '@/components/push/PushOffer'

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
  const recent = (status: 'completed' | 'in_progress' | 'pending' | 'abandoned') =>
    libraryVisible ? getRecentLibraryByStatus(profileUser.id, status, 8) : Promise.resolve([])
  const [stats, recentCompleted, recentInProgress, recentPending, recentAbandoned, canShareCollection] = await Promise.all([
    // Biblioteca oculta (D-04b): ni se consulta (la RLS devolvería 0 filas).
    libraryVisible ? getUserStats(profileUser.id) : Promise.resolve(EMPTY_STATS),
    recent('completed'),
    recent('in_progress'),
    recent('pending'),
    recent('abandoned'),
    // Solo el dueño ve el botón; para el resto ni se consulta.
    isOwnProfile ? hasPublicLists(profileUser.id) : Promise.resolve(false),
  ])

  /** Entrada de biblioteca → título del álbum (nota fina, avance y fecha si se saben). */
  const toShelf = (entry: LibraryEntryWithProgress & { updatedAt?: string | null }): ShelfItem => {
    const type = entry.mediaId.split('_')[0]
    return {
      mediaId: entry.mediaId,
      title: entry.title ?? '',
      poster: entry.poster ?? null,
      type,
      rating10: entry.rating10 ?? null,
      progress: progressRatio(type, entry.progress ?? null),
      updatedAt: entry.updatedAt ?? null,
    }
  }
  const completedItems = recentCompleted.map(toShelf)
  const inProgressItems = recentInProgress.map(toShelf)
  const pendingItems = recentPending.map(toShelf)
  const abandonedItems = recentAbandoned.map(toShelf)

  const hasAnyContent =
    completedItems.length > 0 || inProgressItems.length > 0 || pendingItems.length > 0 || abandonedItems.length > 0
  // REN-6: prioridad solo para la primera fila de portadas de la página.
  const firstShelf = inProgressItems.length > 0 ? 'in_progress' : completedItems.length > 0 ? 'completed' : 'other'

  return (
    <main className="page-grid flex flex-col gap-10 py-8 [&>*]:max-w-5xl md:gap-12">
      {/* La tapa del álbum */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-1">
          <ProfileHeader
            userId={profileUser.id}
            username={profileUser.username}
            avatarColor={profileUser.avatar_color}
            avatarInitials={profileUser.avatar_initials}
            avatarIcon={profileUser.avatar_icon ?? null}
            createdAt={profileUser.created_at}
            bio={profileUser.bio}
            isOwner={isOwnProfile}
            totalItems={stats.totalItems}
            totalCompleted={stats.totalCompleted}
            totalInProgress={stats.totalInProgress}
            showCounters={libraryVisible}
          />
        </div>
        {currentUser && !isOwnProfile && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
            <FriendshipButton
              initialStatus={friendshipStatus}
              targetUserId={profileUser.id}
              friendshipId={friendshipId}
            />
            <ReportButton targetType="user" targetId={profileUser.id} />
            {/* Tras pedir o aceptar la amistad se ofrecen los avisos push. */}
            <PushOffer />
          </div>
        )}
        {isOwnProfile && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
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

      {/* Lo último que ha hecho tu amigo (PRO-7): no retrasa el resto. */}
      {currentUser && friendshipStatus === 'accepted' && libraryVisible && (
        <Suspense fallback={<FriendsActivitySkeleton />}>
          <FriendProfileActivity viewerId={currentUser.id} friendId={profileUser.id} locale={locale} />
        </Suspense>
      )}

      {/* Sus páginas, por estado */}
      <ProfileShelf
        id="shelf-in-progress"
        title={t('watchingNow')}
        status="in_progress"
        items={inProgressItems}
        priorityCount={firstShelf === 'in_progress' ? 4 : 0}
      />
      <ProfileShelf
        id="shelf-completed"
        title={t('lastCompleted')}
        status="completed"
        items={completedItems}
        priorityCount={firstShelf === 'completed' ? 4 : 0}
      />
      <ProfileShelf id="shelf-pending" title={t('pendingRow')} status="pending" items={pendingItems} />
      <ProfileShelf id="shelf-abandoned" title={t('abandonedRow')} status="abandoned" items={abandonedItems} />

      {/* Biblioteca oculta por su dueño (D-04b) */}
      {!libraryVisible && (
        <div className="flex flex-col items-start gap-2 rounded-bento border-2 border-dashed border-slot-line px-5 py-6 md:px-8">
          <p className="font-display text-xl text-text-primary">
            {t('libraryHidden', { username: profileUser.username })}
          </p>
          <p className="max-w-prose text-sm text-text-secondary">
            {visibility === 'friends' ? t('libraryHiddenFriends') : t('libraryHiddenPrivate')}
          </p>
        </div>
      )}

      {/* Empty state cuando la biblioteca está vacía */}
      {libraryVisible && !hasAnyContent && (
        <div className="flex flex-col items-start gap-2 rounded-bento border-2 border-dashed border-slot-line px-5 py-6 md:px-8">
          <p className="font-display text-xl text-text-primary">
            {isOwnProfile
              ? t('emptyOwn')
              : t('emptyOther', { username: profileUser.username })}
          </p>
          <p className="max-w-prose text-sm text-text-secondary">
            {isOwnProfile ? t('emptyOwnHint') : t('emptyOtherHint')}
          </p>
          {isOwnProfile ? (
            <KButton asChild size="sm" className="mt-2">
              <Link href="/search">{t('emptyOwnAction')}</Link>
            </KButton>
          ) : null}
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
