'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { IconUserPlus } from '@/components/icons'
import { InviteFriendsModal } from '@/components/social/InviteFriendsModal'
import { F0 } from '@/lib/design/f0-tokens'

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
        className="flex-shrink-0 rounded-full font-bold border-2"
        style={{ borderColor: F0.stroke, color: F0.textSecondary }}
      >
        <IconUserPlus className="w-3.5 h-3.5" />
        {t('invite')}
      </KButton>
      {open && <InviteFriendsModal groupId={groupId} onClose={() => setOpen(false)} />}
    </>
  )
}
