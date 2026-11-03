// ============================================================
// KULTURA — ProfileHeader (Server Component)
// La tapa del álbum de una persona, de noche: su avatar con el borde blanco
// de un cromo, el nombre en Lilita, desde cuándo está (solo si se sabe), la
// bio y sus números en las cajas de numeración del álbum. Sin banda de
// héroe ni degradados: la noche es el fondo y los números mandan.
// ============================================================

import { getTranslations, getLocale } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { NumberBadge } from '@/components/album/NumberBadge'
import { ProfileBio } from '@/components/profile/ProfileBio'
import { formatCount } from '@/lib/design/format'

interface ProfileHeaderProps {
  userId: string
  username: string
  avatarColor: string
  avatarInitials: string
  avatarIcon?: string | null
  /** Fecha de alta; sin ella (o inválida) no se pinta «En KULTURA desde». */
  createdAt: string | null
  bio: string | null
  isOwner: boolean
  totalItems: number
  totalCompleted: number
  totalInProgress: number
  /**
   * D-04b: con la biblioteca oculta para quien mira, los contadores no se
   * pintan (antes enseñaban "0 títulos", que era falso). Por defecto, sí.
   */
  showCounters?: boolean
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
  showCounters = true,
}: ProfileHeaderProps) {
  const t = await getTranslations('profile')
  const locale = await getLocale()

  // Sin fecha de alta (la columna admite null) o con una inválida, la línea no
  // se pinta: mejor nada que una fecha inventada o un RangeError.
  const joinedAt = createdAt ? new Date(createdAt) : null
  const formattedDate =
    joinedAt && Number.isFinite(joinedAt.getTime())
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(joinedAt)
      : null

  const stats = [
    { key: 'items', value: totalItems, label: t('totalItems', { count: totalItems }) },
    { key: 'completed', value: totalCompleted, label: t('completed', { count: totalCompleted }) },
    { key: 'inProgress', value: totalInProgress, label: t('inProgress') },
  ]

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex items-end gap-4 md:gap-6">
        <Avatar
          color={avatarColor}
          initials={avatarInitials}
          icon={avatarIcon}
          size="lg"
          className="h-20 w-20 shrink-0 rounded-cromo border-[3px] border-cromo-border text-2xl md:h-28 md:w-28 md:text-3xl"
        />
        <div className="min-w-0 pb-1">
          <h1 className="break-words font-display text-3xl text-text-primary [overflow-wrap:anywhere] md:text-4xl">
            {username}
          </h1>
          {formattedDate ? (
            <p className="mt-1 text-sm text-text-tertiary">{t('memberSince', { date: formattedDate })}</p>
          ) : null}
        </div>
      </div>

      <ProfileBio bio={bio} isOwner={isOwner} userId={userId} />

      {/* Los números del álbum: la cifra en su caja y, debajo, lo que cuenta. */}
      {showCounters ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {stats.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <NumberBadge n={formatCount(s.value, locale)} tone="surface" size="md" />
              <span className="text-sm font-semibold text-text-secondary">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
