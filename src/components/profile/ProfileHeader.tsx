// ============================================================
// KULTURA — ProfileHeader (Server Component)
// Portada + avatar solapado + nombre, bio y contadores sueltos (artboard).
// ============================================================

import { getTranslations, getLocale } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { ProfileBio } from '@/components/profile/ProfileBio'

interface ProfileHeaderProps {
  userId: string
  username: string
  avatarColor: string
  avatarInitials: string
  avatarIcon?: string | null
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
  avatarIcon,
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

  const stats = [
    { value: totalItems, label: t('totalItems') },
    { value: totalCompleted, label: t('completed') },
    { value: totalInProgress, label: t('inProgress') },
  ]

  return (
    <section className="w-full">
      {/* Portada (artboard): banda de 160px, radio 28, SIN borde, con la misma
          fórmula de dos capas que GroupDetail (E-DETALLE-ARTBOARD). Antes era
          una tarjeta única con borde y los contadores dentro tras un border-t:
          el mismo error ya corregido en GroupDetail. */}
      <div
        aria-hidden="true"
        className="h-[120px] md:h-[160px] rounded-bento-lg"
        style={{
          background:
            'radial-gradient(120% 100% at 20% 10%, oklch(55% 0.2 260 / 0.6) 0%, transparent 55%), linear-gradient(160deg, oklch(30% 0.1 260), oklch(16% 0.06 240))',
        }}
      />

      {/* Avatar solapando la portada + nombre a su lado */}
      <div className="flex items-end gap-4 md:gap-5 -mt-10 md:-mt-12 pl-4 md:pl-8">
        <Avatar
          color={avatarColor}
          initials={avatarInitials}
          icon={avatarIcon}
          size="lg"
          className="w-[88px] h-[88px] md:w-[110px] md:h-[110px] text-2xl md:text-[34px] font-extrabold rounded-[28px_28px_28px_8px] border-[5px] border-bg"
        />
        <div className="pb-2.5 min-w-0">
          <h1 className="font-display text-2xl md:text-[28px] font-extrabold text-text-primary leading-tight truncate">
            {username}
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            {t('memberSince')} {formattedDate}
          </p>
        </div>
      </div>

      {/* Bio */}
      <div className="mt-5">
        <ProfileBio bio={bio} isOwner={isOwner} userId={userId} />
      </div>

      {/* Contadores: tarjetas SUELTAS (radio 20, padding 16/26, gap 16) */}
      <ul className="flex flex-wrap gap-4 mt-7">
        {stats.map((s) => (
          <li key={s.label} className="bg-surface-default rounded-20 px-[26px] py-4">
            <p className="font-display text-2xl font-extrabold text-text-primary leading-none tabular-nums">{s.value}</p>
            <p className="text-xs font-semibold text-text-tertiary mt-1.5">{s.label}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
