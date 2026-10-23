'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToastContext } from '@/components/ui/ToastProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { KButton } from '@/components/ui/KButton'
import { Modal } from '@/components/ui/Modal'
import { F0 } from '@/lib/design/f0-tokens'

interface InvitableFriend {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
}

interface InviteFriendsModalProps {
  groupId: string
  onClose: () => void
}

export function InviteFriendsModal({ groupId, onClose }: InviteFriendsModalProps) {
  const t = useTranslations('groups')
  const tc = useTranslations('common')
  const { show } = useToastContext()

  const [friends, setFriends] = useState<InvitableFriend[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/invitations`)
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          setLoadError(true)
          setLoading(false)
          return
        }
        setFriends((data.friends ?? []) as InvitableFriend[])
        setLoading(false)
      } catch {
        if (!active) return
        setLoadError(true)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [groupId])

  async function handleInvite(inviteeId: string) {
    setInvitingId(inviteeId)
    try {
      const res = await fetch(`/api/groups/${groupId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteeId }),
      })
      if (!res.ok) {
        show({ message: t('inviteError'), type: 'error' })
        setInvitingId(null)
        return
      }
      show({ message: t('inviteSent'), type: 'success' })
      // Quitar al invitado de la lista (ya no es invitable)
      setFriends((prev) => prev.filter((f) => f.id !== inviteeId))
      setInvitingId(null)
    } catch {
      show({ message: t('inviteError'), type: 'error' })
      setInvitingId(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('inviteFriends')} closeLabel={tc('close')}>
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" label={tc('loading')} />
        </div>
      ) : loadError ? (
        <p role="alert" className="text-sm py-4 text-center" style={{ color: F0.orange }}>{t('inviteError')}</p>
      ) : friends.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: F0.muted }}>{t('noInvitableFriends')}</p>
      ) : (
        <ul className="flex flex-col max-h-72 overflow-y-auto">
          {friends.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 py-2.5 border-t first:border-t-0"
              style={{ borderColor: F0.stroke }}
            >
              <Avatar initials={f.avatarInitials} color={f.avatarColor} size="sm" />
              <span id={`invite-${groupId}-${f.id}`} className="text-sm flex-1 truncate font-medium" style={{ color: F0.text }}>{f.username}</span>
              <KButton
                size="sm"
                onClick={() => handleInvite(f.id)}
                loading={invitingId === f.id}
                // "Invitar" + nombre: en la lista del lector cada botón dice a quién.
                aria-describedby={`invite-${groupId}-${f.id}`}
                className="min-h-11 px-4"
              >
                {t('invite')}
              </KButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
