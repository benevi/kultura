'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'

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
  const [showNewChat, setShowNewChat] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => { setConversations(d.conversations ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function startConversation(friendId: string) {
    setStartingChat(friendId)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: friendId }),
    })
    const data = await res.json()
    if (data.conversationId) {
      window.location.href = `/chat/${data.conversationId}`
    }
    setStartingChat(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {conversations.length > 0 ? `${conversations.length} conversaciones` : ''}
        </span>
        <button
          onClick={() => setShowNewChat(v => !v)}
          className="px-3 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          + {t('startChat')}
        </button>
      </div>

      {/* New chat: select a friend */}
      {showNewChat && (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-text mb-1">{t('selectFriend')}</p>
          {friends.length === 0 ? (
            <p className="text-sm text-muted">{t('noFriendsToChat')}</p>
          ) : (
            friends.map(f => (
              <button
                key={f.id}
                data-testid="friend-picker-item"
                onClick={() => startConversation(f.id)}
                disabled={startingChat === f.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface2 transition-colors text-left disabled:opacity-50"
              >
                <Avatar initials={f.avatar_initials} color={f.avatar_color} size="sm" />
                <span className="text-sm text-text">{f.username}</span>
                {startingChat === f.id && <span className="ml-auto text-xs text-muted">...</span>}
              </button>
            ))
          )}
        </div>
      )}

      {/* Conversations list */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">...</div>
      ) : conversations.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center flex flex-col gap-2">
          <div className="text-4xl">💬</div>
          <p className="font-semibold text-text">{t('noConversations')}</p>
          <p className="text-sm text-muted">{t('noConversationsHint')}</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition-colors"
            >
              {conv.otherUser ? (
                <Avatar
                  initials={conv.otherUser.avatar_initials}
                  color={conv.otherUser.avatar_color}
                  size="md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface2" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${conv.unread ? 'text-text' : 'text-muted'}`}>
                    {conv.otherUser?.username ?? '?'}
                  </span>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-muted flex-shrink-0">
                      {relativeDate(conv.lastMessageAt, locale)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className={`text-xs truncate mt-0.5 ${conv.unread ? 'text-text' : 'text-muted'}`}>
                    {conv.lastMessage.isMine ? `${t('you')}: ` : ''}{conv.lastMessage.content}
                  </p>
                )}
              </div>
              {conv.unread && (
                <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
