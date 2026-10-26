'use client'

import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { Modal } from '@/components/ui/Modal'

interface Friend {
  friendshipId: string
  user: {
    id: string
    username: string
    avatar_color: string
    avatar_initials: string
  }
}

interface RecommendModalProps {
  mediaId: string
  mediaCache: {
    externalId: string
    type: string
    title: string
    poster?: string
    backdrop?: string
    year?: number
    synopsis?: string
    genres?: string[]
  }
  onClose: () => void
}

export function RecommendModal({ mediaId, mediaCache, onClose }: RecommendModalProps) {
  const t = useTranslations('recommendations')
  const tc = useTranslations('common')
  const messageId = useId()

  const [friends, setFriends] = useState<Friend[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/friends')
      .then((r) => r.json())
      .then((data: { friends?: Friend[] }) => {
        setFriends(data.friends ?? [])
      })
      .catch(() => setFriends([]))
      .finally(() => setLoadingFriends(false))
  }, [])

  function toggleFriend(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) return
    setStatus('sending')
    const results = await Promise.allSettled(
      Array.from(selected).map((toUserId) =>
        fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUserId, mediaId, message: message || undefined, mediaCache }),
        }).then((r) => {
          if (!r.ok) throw new Error('Failed')
        })
      )
    )
    const anyFailed = results.some((r) => r.status === 'rejected')
    if (anyFailed) {
      setStatus('error')
    } else {
      setStatus('sent')
      setTimeout(onClose, 1200)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={t('recommendTo')}
      closeLabel={tc('close')}
      dismissible={status !== 'sending'}
    >
      {/* Lista de amigos: casillas nativas dentro de un grupo con nombre. */}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm text-text-secondary">{t('selectFriends')}</legend>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {loadingFriends && (
            <p role="status" className="text-sm text-text-secondary text-center py-4">{t('loadingFriends')}</p>
          )}
          {!loadingFriends && friends.length === 0 && (
            <p className="text-sm text-text-secondary text-center py-4">{t('noFriends')}</p>
          )}
          {friends.map((f) => (
            <label
              key={f.user.id}
              className="flex min-h-11 items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-surface-default transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(f.user.id)}
                onChange={() => toggleFriend(f.user.id)}
                className="h-5 w-5 accent-accent-positive"
              />
              <Avatar
                initials={f.user.avatar_initials}
                color={f.user.avatar_color}
                size="sm"
              />
              <span className="text-sm font-medium text-text-primary">{f.user.username}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Mensaje */}
      {friends.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={messageId} className="text-sm text-text-secondary">{t('message')}</label>
          <textarea
            id={messageId}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('messagePlaceholder')}
            rows={2}
            maxLength={500}
            className="w-full bg-surface-default border border-field-border rounded-2xl px-3 py-2 text-base md:text-sm text-text-primary placeholder:text-text-tertiary resize-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
        </div>
      )}

      {/* Resultado del envío: región viva que existe desde el principio. */}
      <p role="status" className={status === 'sent' ? 'text-sm text-accent-positive' : 'sr-only'}>
        {status === 'sent' ? t('sent') : ''}
      </p>
      {status === 'error' && (
        <p role="alert" className="text-sm text-accent-danger">{t('error')}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <KButton variant="secondary" onClick={onClose} disabled={status === 'sending'}>
          {t('cancel')}
        </KButton>
        {friends.length > 0 && status !== 'sent' && (
          <KButton
            loading={status === 'sending'}
            disabled={selected.size === 0}
            onClick={handleSend}
          >
            {t('send')}
          </KButton>
        )}
      </div>
    </Modal>
  )
}
