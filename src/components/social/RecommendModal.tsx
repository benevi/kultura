'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'

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
  }
  onClose: () => void
}

export function RecommendModal({ mediaId, mediaCache, onClose }: RecommendModalProps) {
  const t = useTranslations('recommendations')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-backdrop-in">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm flex flex-col gap-4 p-5 animate-modal-in">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t('recommendTo')}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Lista de amigos */}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {loadingFriends && (
            <p className="text-sm text-muted text-center py-4">Cargando...</p>
          )}
          {!loadingFriends && friends.length === 0 && (
            <p className="text-sm text-muted text-center py-4">{t('noFriends')}</p>
          )}
          {friends.map((f) => (
            <label
              key={f.user.id}
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-surface2 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(f.user.id)}
                onChange={() => toggleFriend(f.user.id)}
                className="accent-accent"
              />
              <Avatar
                initials={f.user.avatar_initials}
                color={f.user.avatar_color}
                size="sm"
              />
              <span className="text-sm font-medium text-text">{f.user.username}</span>
            </label>
          ))}
        </div>

        {/* Mensaje */}
        {friends.length > 0 && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('messagePlaceholder')}
            rows={2}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-text placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          {friends.length > 0 && status !== 'sent' && (
            <Button
              variant="primary"
              size="sm"
              loading={status === 'sending'}
              disabled={selected.size === 0}
              onClick={handleSend}
            >
              {t('send')}
            </Button>
          )}
          {status === 'sent' && (
            <span className="text-sm text-success self-center">{t('sent')}</span>
          )}
          {status === 'error' && (
            <span className="text-sm text-danger self-center">{t('error')}</span>
          )}
        </div>
      </div>
    </div>
  )
}
