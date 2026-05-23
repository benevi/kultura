'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { respondToFriendRequest, removeFriend } from '@/lib/social/actions'
import type { Friendship } from '@/types/user'

interface FriendCardProps {
  friendship: Friendship
  /** 'friend' = amistad aceptada, 'pending' = solicitud entrante */
  variant: 'friend' | 'pending'
  onAction: (friendshipId: string) => void
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
    } catch (err) {
      console.error('Failed to accept friend request:', err)
      setLoading(false)
    }
  }

  async function handleDecline() {
    setLoading(true)
    try {
      await respondToFriendRequest(friendship.id, 'decline')
      onAction(friendship.id)
    } catch (err) {
      console.error('Failed to decline friend request:', err)
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFriend(friendship.id)
      onAction(friendship.id)
    } catch (err) {
      console.error('Failed to remove friend:', err)
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      <Link href={`/profile/${otherUser.username}`}>
        <Avatar
          initials={otherUser.avatarInitials}
          color={otherUser.avatarColor}
          size="md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${otherUser.username}`}
          className="font-medium text-text-primary hover:text-accent-positive transition-colors block truncate"
        >
          {otherUser.username}
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {variant === 'pending' ? (
          <>
            <KButton size="sm" variant="primary" loading={loading} onClick={handleAccept}>
              {t('accept')}
            </KButton>
            <KButton size="sm" variant="secondary" loading={loading} onClick={handleDecline}>
              {t('decline')}
            </KButton>
          </>
        ) : (
          <KButton
            size="sm"
            variant="secondary"
            loading={loading}
            onClick={handleRemove}
            className="text-text-secondary hover:text-accent-danger"
          >
            {t('removeFriend')}
          </KButton>
        )}
      </div>
    </div>
  )
}
