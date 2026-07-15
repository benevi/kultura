'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'

interface OtherUser {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

interface Conversation {
  id: string
  lastMessageAt: string | null
  otherUser: OtherUser | null
  lastMessage: { content: string; isMine: boolean } | null
  unread: boolean
}

interface Friend {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

function relativeDate(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.floor(hours / 24), 'day')
}

interface Props {
  friends: Friend[]
}

export function ChatClient({ friends }: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)
  const [startError, setStartError] = useState<null | 'generic' | 'notFriends'>(null)

  const loadConversations = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => { setConversations(d.conversations ?? []); setLoading(false) })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  async function startConversation(friendId: string) {
    setStartingChat(friendId)
    setStartError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: friendId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.conversationId) {
        setStartError(res.status === 403 ? 'notFriends' : 'generic')
        return
      }
      window.location.href = `/chat/${data.conversationId}`
    } catch {
      setStartError('generic')
    } finally {
      setStartingChat(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {conversations.length > 0 ? t('conversationCount', { count: conversations.length }) : ''}
        </span>
        <KButton
          variant="primary"
          size="sm"
          onClick={() => setShowNewChat(v => !v)}
        >
          + {t('startChat')}
        </KButton>
      </div>

      {/* New chat: select a friend */}
      {showNewChat && (
        <div className="bg-surface-default border border-surface-border rounded-[8px] p-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-text-primary mb-1">{t('selectFriend')}</p>
          {friends.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('noFriendsToChat')}</p>
          ) : (
            friends.map(f => (
              <button
                key={f.id}
                data-testid="friend-picker-item"
                onClick={() => startConversation(f.id)}
                disabled={startingChat === f.id}
                className="flex items-center gap-3 p-2 rounded-[10px] hover:bg-surface-elevated transition-colors text-left disabled:opacity-50"
              >
                <Avatar initials={f.avatar_initials} color={f.avatar_color} size="sm" />
                <span className="text-sm text-text-primary">{f.username}</span>
                {startingChat === f.id && <span className="ml-auto text-xs text-text-secondary">...</span>}
              </button>
            ))
          )}
          {startError && (
            <p role="alert" className="text-xs text-accent-danger">
              {t(startError === 'notFriends' ? 'notFriendsError' : 'startError')}
            </p>
          )}
        </div>
      )}

      {/* Conversations list */}
      {loading ? (
        <div className="text-center py-12 text-text-secondary text-sm">...</div>
      ) : loadError ? (
        <div className="bg-surface-default border border-surface-border rounded-[8px] p-10 text-center flex flex-col gap-3">
          <p className="text-sm text-text-secondary">{t('loadError')}</p>
          <div>
            <KButton variant="secondary" size="sm" onClick={loadConversations}>
              {t('retry')}
            </KButton>
          </div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-surface-default border border-surface-border rounded-[8px] p-10 text-center flex flex-col gap-2">
          <div className="text-4xl">💬</div>
          <p className="font-semibold text-text-primary">{t('noConversations')}</p>
          <p className="text-sm text-text-secondary">{t('noConversationsHint')}</p>
        </div>
      ) : (
        <div className="bg-surface-default border border-surface-border rounded-[8px] overflow-hidden divide-y divide-surface-border">
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated transition-colors"
            >
              {conv.otherUser ? (
                <Avatar
                  initials={conv.otherUser.avatar_initials}
                  color={conv.otherUser.avatar_color}
                  size="md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-elevated" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${conv.unread ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {conv.otherUser?.username ?? '?'}
                  </span>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-text-secondary flex-shrink-0">
                      {relativeDate(conv.lastMessageAt, locale)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className={`text-xs truncate mt-0.5 ${conv.unread ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {conv.lastMessage.isMine ? `${t('you')}: ` : ''}{conv.lastMessage.content}
                  </p>
                )}
              </div>
              {conv.unread && (
                <div className="w-2 h-2 rounded-full bg-accent-positive flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
