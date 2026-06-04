'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'
import { InviteFriendsModal } from '@/components/social/InviteFriendsModal'

interface Props {
  groupId: string
}

export function InviteButton({ groupId }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('groups')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface2 text-text-primary rounded-full hover:bg-surface-elevated transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {t('invite')}
      </button>
      {open && <InviteFriendsModal groupId={groupId} onClose={() => setOpen(false)} />}
    </>
  )
}
