'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { sendFriendRequest, respondToFriendRequest, removeFriend } from '@/lib/social/actions'
import type { FriendshipStatusResult } from '@/lib/social/friends'

interface FriendshipButtonProps {
  /** Estado inicial de la relación */
  initialStatus: FriendshipStatusResult
  /** ID del usuario objetivo */
  targetUserId: string
  /** ID de la amistad (necesario para accept/decline/remove) */
  friendshipId?: string
}

export function FriendshipButton({
  initialStatus,
  targetUserId,
  friendshipId: initialFriendshipId,
}: FriendshipButtonProps) {
  const t = useTranslations('friends')
  const [status, setStatus] = useState<FriendshipStatusResult>(initialStatus)
  const [fId, setFId] = useState<string | undefined>(initialFriendshipId)
  const [loading, setLoading] = useState(false)

  async function handleSendRequest() {
    setLoading(true)
    try {
      await sendFriendRequest(targetUserId)
      setStatus('pending_sent')
    } catch (err) {
      console.error('Failed to send friend request:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!fId) return
    setLoading(true)
    try {
      await respondToFriendRequest(fId, 'accept')
      setStatus('accepted')
    } catch (err) {
      console.error('Failed to accept friend request:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!fId) return
    setLoading(true)
    try {
      await removeFriend(fId)
      setStatus('none')
      setFId(undefined)
    } catch (err) {
      console.error('Failed to remove friend:', err)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'none') {
    return (
      <KButton variant="primary" size="sm" loading={loading} onClick={handleSendRequest}>
        {t('addFriend')}
      </KButton>
    )
  }

  if (status === 'pending_sent') {
    return (
      <KButton variant="secondary" size="sm" disabled>
        {t('requestSent')}
      </KButton>
    )
  }

  if (status === 'pending_received') {
    return (
      <KButton variant="primary" size="sm" loading={loading} onClick={handleAccept}>
        {t('accept')}
      </KButton>
    )
  }

  // accepted — "Quitar amigo" es acción destructiva → accent-danger
  return (
    <KButton
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleRemove}
      className="text-text-secondary hover:text-accent-danger hover:border-accent-danger"
    >
      {t('friends')} ✓
    </KButton>
  )
}
