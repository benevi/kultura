'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { useToastContext } from '@/components/ui/ToastProvider'
import { F0 } from '@/lib/design/f0-tokens'
import { ApiError } from '@/lib/api/client'
import { toggleGroupMembership } from '@/lib/groups/client'
import { GROUP_ERRORS } from '@/lib/groups/errors'

interface Props {
  groupId: string
  isMember: boolean
  isOwner: boolean
}

export function JoinGroupButton({ groupId, isMember, isOwner }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const t = useTranslations('friends')
  const tGroups = useTranslations('groups')
  const { show } = useToastContext()

  if (isOwner) return null

  async function handleClick() {
    setLoading(true)
    try {
      await toggleGroupMembership(groupId)
      router.refresh()
    } catch (err) {
      // F-11: vetado por el dueño (o grupo privado): mensaje propio.
      const notAllowed = err instanceof ApiError && err.message === GROUP_ERRORS.joinNotAllowed
      show({ message: notAllowed ? tGroups('joinNotAllowed') : t('joinGroupError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (isMember) {
    return (
      <KButton
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="flex-shrink-0 rounded-full font-bold border-2"
        style={{ borderColor: F0.stroke, color: F0.textSecondary }}
      >
        {loading ? '…' : t('leaveGroup')}
      </KButton>
    )
  }

  return (
    <KButton
      variant="primary"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="flex-shrink-0 rounded-full font-extrabold"
      style={{ background: F0.pink, color: F0.onPink }}
    >
      {loading ? '…' : t('joinGroup')}
    </KButton>
  )
}
