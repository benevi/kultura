'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { IconUserPlus } from '@/components/icons'
import { InviteFriendsModal } from '@/components/social/InviteFriendsModal'

interface Props {
  groupId: string
}

export function InviteButton({ groupId }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('groups')

  return (
    <>
      <KButton
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex-shrink-0"
      >
        <IconUserPlus className="w-3.5 h-3.5" />
        {t('invite')}
      </KButton>
      {open && <InviteFriendsModal groupId={groupId} onClose={() => setOpen(false)} />}
    </>
  )
}
