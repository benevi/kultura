// ============================================================
// KULTURA — ProfileHeader (Server Component)
// Avatar + username + bio + stats row (total, completados, en progreso).
// ============================================================

import { getTranslations, getLocale } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { ProfileBio } from '@/components/profile/ProfileBio'
import { heroGradient, hueFromSeed } from '@/lib/design/gradient'

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

  // Estadísticas en cards F0 (mockup Profile): surface, radio 20px, número
  // display 800 + etiqueta muted.
  const statCards = [
    { value: totalItems, label: t('totalItems') },
    { value: totalCompleted, label: t('completed') },
    { value: totalInProgress, label: t('inProgress') },
  ]

  return (
    <div className="w-full flex flex-col">
      {/* Banner — card "feature": acento radial sobre gradiente del mismo
          matiz, estable por usuario. */}
      <div
        aria-hidden="true"
        className="h-[120px] md:h-[160px] rounded-[32px]"
        style={{ background: heroGradient(hueFromSeed(userId)) }}
      />

      {/* Avatar solapando el banner + nombre */}
      <div className="flex items-end gap-4 md:gap-5 -mt-10 md:-mt-12 pl-4 md:pl-8">
        <Avatar
          color={avatarColor}
          initials={avatarInitials}
          size="lg"
          className="w-[88px] h-[88px] md:w-[110px] md:h-[110px] text-[28px] md:text-[34px] font-extrabold rounded-[32px_32px_32px_8px] border-[5px] border-surface-base"
        />
        <div className="flex flex-col gap-1 pb-2.5 min-w-0">
          <h1 className="font-display text-2xl md:text-[28px] font-extrabold text-text-primary leading-tight truncate">
            {username}
          </h1>
          <p className="text-sm text-text-tertiary">
            @{username} · {t('memberSince')} {formattedDate}
          </p>
        </div>
      </div>

      {/* Bio */}
      <div className="mt-5">
        <ProfileBio bio={bio} isOwner={isOwner} userId={userId} />
      </div>

      {/* Stats */}
      <div className="flex gap-4 mt-6 overflow-x-auto scrollbar-hide">
        {statCards.map(({ value, label }) => (
          <div key={label} className="shrink-0 rounded-[20px] bg-surface-default px-[26px] py-4">
            <p className="font-display text-2xl font-extrabold text-text-primary leading-none">{value}</p>
            <p className="text-xs font-semibold text-text-tertiary mt-1.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
