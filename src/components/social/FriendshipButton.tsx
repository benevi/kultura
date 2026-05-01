'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
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
      <Button variant="primary" size="sm" loading={loading} onClick={handleSendRequest}>
        {t('addFriend')}
      </Button>
    )
  }

  if (status === 'pending_sent') {
    return (
      <Button variant="ghost" size="sm" disabled>
        {t('requestSent')}
      </Button>
    )
  }

  if (status === 'pending_received') {
    return (
      <Button variant="primary" size="sm" loading={loading} onClick={handleAccept}>
        {t('accept')}
      </Button>
    )
  }

  // accepted
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={loading}
      onClick={handleRemove}
      className="text-muted hover:text-red-400"
    >
      {t('friends')} ✓
    </Button>
  )
}
