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
        className="bg-surface-default rounded-[32px] w-full max-w-sm flex flex-col gap-4 p-6 animate-modal-in"
        style={{ boxShadow: '10px 10px 0 var(--surface-elevated)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{t('inviteFriends')}</h2>
          <button
            onClick={onClose}
            aria-label={tc('cancel')}
            className="text-xl leading-none hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : loadError ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--accent-orange)' }}>{t('inviteError')}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>{t('noInvitableFriends')}</p>
        ) : (
          <ul className="flex flex-col max-h-72 overflow-y-auto">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 py-2.5 border-t first:border-t-0"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <Avatar initials={f.avatarInitials} color={f.avatarColor} size="sm" />
                <span className="text-sm flex-1 truncate font-medium" style={{ color: 'var(--text-primary)' }}>{f.username}</span>
                <button
                  onClick={() => handleInvite(f.id)}
                  disabled={invitingId === f.id}
                  className="flex-shrink-0 px-3.5 py-1.5 text-xs font-extrabold rounded-full hover:brightness-110 transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent-pink)', color: 'var(--on-accent-pink)' }}
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
