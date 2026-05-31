'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useToastContext } from '@/components/ui/ToastProvider'

interface Props {
  groupId: string
  isMember: boolean
  isOwner: boolean
}

export function JoinGroupButton({ groupId, isMember, isOwner }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const t = useTranslations('friends')
  const { show } = useToastContext()

  if (isOwner) return null

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        show({ message: t('joinGroupError'), type: 'error' })
      }
    } catch {
      show({ message: t('joinGroupError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (isMember) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-surface2 text-muted rounded-full hover:bg-red-950/40 hover:text-danger transition-colors disabled:opacity-50"
      >
        {loading ? '…' : t('leaveGroup')}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex-shrink-0 px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-full hover:bg-accent/80 transition-colors disabled:opacity-50"
    >
      {loading ? '…' : t('joinGroup')}
    </button>
  )
}
