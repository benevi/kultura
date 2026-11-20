'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { respondToFriendRequest, removeFriend } from '@/lib/social/actions'
import { createLogger } from '@/lib/logger'
import type { Friendship } from '@/types/user'
import { offerPushInContext } from '@/lib/push/offer'

const log = createLogger('FriendCard')

interface FriendCardProps {
  friendship: Friendship
  /** 'friend' = amistad aceptada, 'pending' = solicitud entrante */
  variant: 'friend' | 'pending'
  onAction: (friendshipId: string) => void
}

/**
 * Anillo "story" F0 (avatares circulares con actividad):
 * conic-gradient de 3 colores de la paleta + hueco --bg de 3px. Aquí marca
 * "esto requiere tu atención" sobre el avatar de una solicitud pendiente,
 * no un dato inventado — solo el tratamiento visual del avatar ya real.
 */
function AttentionRing({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-full p-[3px] flex-shrink-0 bg-[conic-gradient(from_180deg,var(--accent-pink),var(--accent-orange),var(--accent-lime),var(--accent-pink))]"
    >
      <div className="rounded-full p-[3px] bg-surface-base">
        {children}
      </div>
    </div>
  )
}

export function FriendCard({ friendship, variant, onAction }: FriendCardProps) {
  const t = useTranslations('friends')
  const [loading, setLoading] = useState(false)
  const { otherUser } = friendship

  if (!otherUser) return null

  async function handleAccept() {
    setLoading(true)
    try {
      await respondToFriendRequest(friendship.id, 'accept')
      onAction(friendship.id)
      offerPushInContext('friends')
    } catch (err) {
      log.error('Failed to accept friend request', { err })
      setLoading(false)
    }
  }

  async function handleDecline() {
    setLoading(true)
    try {
      await respondToFriendRequest(friendship.id, 'decline')
      onAction(friendship.id)
    } catch (err) {
      log.error('Failed to decline friend request', { err })
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFriend(friendship.id)
      onAction(friendship.id)
    } catch (err) {
      log.error('Failed to remove friend', { err })
      setLoading(false)
    }
  }

  const avatar = <Avatar initials={otherUser.avatarInitials} color={otherUser.avatarColor} size="md" />

  return (
    // Fila suelta del artboard de Amigos: superficie propia, radio 20,
    // padding 16/22 y gap 16 — sin borde ni separadores.
    <div
      className="flex items-center gap-4 rounded-bento px-[22px] py-4 bg-surface-default"
    >
      <Link href={`/profile/${otherUser.username}`}>
        {variant === 'pending' ? <AttentionRing>{avatar}</AttentionRing> : avatar}
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${otherUser.username}`}
          className="font-bold hover:opacity-80 transition-opacity block truncate text-text-primary"
        >
          {otherUser.username}
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {variant === 'pending' ? (
          <>
            <KButton
              size="sm"
              variant="primary"
              loading={loading}
              onClick={handleAccept}
              className="rounded-full font-extrabold"
            >
              {t('accept')}
            </KButton>
            <KButton
              size="sm"
              variant="secondary"
              loading={loading}
              onClick={handleDecline}
              className="rounded-full font-bold border-2 hover:text-text-secondary"
            >
              {t('decline')}
            </KButton>
          </>
        ) : (
          <KButton
            size="sm"
            variant="secondary"
            loading={loading}
            onClick={handleRemove}
            className="rounded-full font-bold border-2 hover:opacity-90 hover:text-text-secondary"
          >
            {t('removeFriend')}
          </KButton>
        )}
      </div>
    </div>
  )
}
