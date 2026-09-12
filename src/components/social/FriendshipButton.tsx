'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { sendFriendRequest, respondToFriendRequest, removeFriend } from '@/lib/social/actions'
import { createLogger } from '@/lib/logger'
import { F0 } from '@/lib/design/f0-tokens'
import type { FriendshipStatusResult } from '@/lib/social/friends'

const log = createLogger('FriendshipButton')

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
      log.error('Failed to send friend request', { err })
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
      log.error('Failed to accept friend request', { err })
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
      log.error('Failed to remove friend', { err })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'none') {
    return (
      <KButton
        variant="primary"
        size="sm"
        loading={loading}
        onClick={handleSendRequest}
        className="rounded-full font-extrabold"
        style={{ background: F0.pink, color: F0.onPink }}
      >
        {t('addFriend')}
      </KButton>
    )
  }

  if (status === 'pending_sent') {
    return (
      <KButton
        variant="secondary"
        size="sm"
        disabled
        className="rounded-full font-bold border-2"
        style={{ borderColor: F0.stroke, color: F0.muted }}
      >
        {t('requestSent')}
      </KButton>
    )
  }

  if (status === 'pending_received') {
    return (
      <KButton
        variant="primary"
        size="sm"
        loading={loading}
        onClick={handleAccept}
        className="rounded-full font-extrabold"
        style={{ background: F0.pink, color: F0.onPink }}
      >
        {t('accept')}
      </KButton>
    )
  }

  // accepted — pill secundario estándar (sin color de "peligro": F0 no define
  // un matiz propio para eso entre los 6 acentos decorativos de CLAUDE.md).
  return (
    <KButton
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleRemove}
      className="rounded-full font-bold border-2 hover:opacity-90"
      style={{ borderColor: F0.stroke, color: F0.textSecondary }}
    >
      {t('friends')} ✓
    </KButton>
  )
}
