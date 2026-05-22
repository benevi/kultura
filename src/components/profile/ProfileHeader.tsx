// ============================================================
// KULTURA — ProfileHeader (Server Component)
// Avatar + username + bio + stats row (total, completados, en progreso).
// ============================================================

import { getTranslations, getLocale } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { ProfileBio } from '@/components/profile/ProfileBio'

interface ProfileHeaderProps {
  userId: string
  username: string
  avatarColor: string
  avatarInitials: string
  createdAt: string
  bio: string | null
  isOwner: boolean
  totalItems: number
  totalCompleted: number
  totalInProgress: number
}

export async function ProfileHeader({
  userId,
  username,
  avatarColor,
  avatarInitials,
  createdAt,
  bio,
  isOwner,
  totalItems,
  totalCompleted,
  totalInProgress,
}: ProfileHeaderProps) {
  const t = await getTranslations('profile')
  const locale = await getLocale()

  const formattedDate = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(createdAt))

  return (
    <div className="bg-surface-default rounded-card p-6 md:p-8 w-full flex flex-col gap-4 border border-surface-border">
      {/* Avatar + nombre */}
      <div className="flex items-center gap-5">
        <Avatar
          color={avatarColor}
          initials={avatarInitials}
          size="lg"
          className="w-16 h-16 md:w-20 md:h-20 text-lg"
        />
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-xl font-bold text-text-primary leading-none">
            {username}
          </h1>
          <p className="text-xs text-text-tertiary">
            {t('memberSince')} {formattedDate}
          </p>
        </div>
      </div>

      {/* Bio */}
      <ProfileBio bio={bio} isOwner={isOwner} userId={userId} />

      {/* Stats en fila */}
      <div className="flex items-center gap-6 pt-2 border-t border-surface-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary leading-none">{totalItems}</p>
          <p className="text-xs text-text-tertiary mt-1">{t('totalItems')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary leading-none">{totalCompleted}</p>
          <p className="text-xs text-text-tertiary mt-1">{t('completed')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary leading-none">{totalInProgress}</p>
          <p className="text-xs text-text-tertiary mt-1">{t('inProgress')}</p>
        </div>
      </div>
    </div>
  )
}
