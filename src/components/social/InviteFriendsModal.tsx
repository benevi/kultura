'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToastContext } from '@/components/ui/ToastProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'

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
    <div
      data-testid="modal-overlay"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-backdrop-in"
    >
      <div
        data-testid="modal-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-elevated border border-surface-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5 animate-modal-in"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text-primary">{t('inviteFriends')}</h2>
          <button
            onClick={onClose}
            aria-label={tc('cancel')}
            className="text-text-secondary hover:text-text-primary text-xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : loadError ? (
          <p className="text-sm text-accent-danger py-4 text-center">{t('inviteError')}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-text-tertiary py-8 text-center">{t('noInvitableFriends')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface-border max-h-72 overflow-y-auto">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <Avatar initials={f.avatarInitials} color={f.avatarColor} size="sm" />
                <span className="text-sm text-text-primary flex-1 truncate">{f.username}</span>
                <button
                  onClick={() => handleInvite(f.id)}
                  disabled={invitingId === f.id}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-accent-positive text-on-accent-positive rounded-full hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {invitingId === f.id ? '…' : t('invite')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
