'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'
import { useToastContext } from '@/components/ui/ToastProvider'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  users: {
    username: string
    avatar_color: string
    avatar_initials: string
  } | null
}

interface OtherUser {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

interface Props {
  conversationId: string
  otherUser: OtherUser | null
  currentUserId: string
}

function timeLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function ConversationClient({ conversationId, otherUser, currentUserId }: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const { show } = useToastContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load messages
  useEffect(() => {
    fetch(`/api/chat/${conversationId}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setLoading(false)
        setTimeout(scrollToBottom, 50)
      })
      .catch(() => setLoading(false))
  }, [conversationId, scrollToBottom])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Omit<Message, 'users'>
          // Fetch sender info
          const { data: senderData } = await supabase
            .from('users')
            .select('username, avatar_color, avatar_initials')
            .eq('id', newMsg.sender_id)
            .maybeSingle()

          const fullMsg: Message = {
            ...newMsg,
            users: senderData ?? null,
          }
          setMessages(prev => {
            // Avoid duplicate if we already added it optimistically
            if (prev.some(m => m.id === fullMsg.id)) return prev
            // Reconcile optimistic temp message with the real one (covers realtime-before-POST race)
            if (fullMsg.sender_id === currentUserId) {
              const i = prev.findIndex(m => m.id.startsWith('temp-') && m.content === fullMsg.content)
              if (i !== -1) {
                const c = [...prev]
                c[i] = fullMsg
                return c
              }
            }
            return [...prev, fullMsg]
          })
          setTimeout(scrollToBottom, 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, scrollToBottom, currentUserId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)

    const content = text.trim()
    setText('')

    // Optimistic add
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      content,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      users: null,
    }
    setMessages(prev => [...prev, tempMsg])
    setTimeout(scrollToBottom, 50)

    const res = await fetch(`/api/chat/${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(content)
      show({ message: t('sendError'), type: 'error' })
    } else {
      // Reconcile: replace the optimistic temp message with the real one (id UUID from server)
      const { message: real } = await res.json().catch(() => ({ message: null }))
      if (real) {
        const realMsg: Message = { ...real, users: null }
        setMessages(prev => prev.map(m => (m.id === tempId ? realMsg : m)))
      }
    }

    setSending(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-default">
        <Link href="/chat" className="text-text-secondary hover:text-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </Link>
        {otherUser ? (
          <>
            <Avatar initials={otherUser.avatar_initials} color={otherUser.avatar_color} size="sm" />
            <Link
              href={`/profile/${otherUser.username}`}
              className="font-semibold text-sm text-text-primary hover:text-accent-info transition-colors"
            >
              {otherUser.username}
            </Link>
          </>
        ) : (
          <span className="text-sm text-text-secondary">...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading && (
          <div className="text-center text-sm text-text-secondary py-8">...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-text-secondary py-8">
            {t('messagePlaceholder')}
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMine && msg.users && (
                <Avatar
                  initials={msg.users.avatar_initials}
                  color={msg.users.avatar_color}
                  size="sm"
                />
              )}
              <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-accent-positive text-on-accent-positive rounded-tr-sm'
                      : 'bg-surface-elevated text-text-primary rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-xs text-text-secondary px-1">
                  {timeLabel(msg.created_at, locale)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-surface-border bg-surface-default"
      >
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('messagePlaceholder')}
          className="flex-1 bg-surface-elevated border border-surface-border rounded-full px-4 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-positive"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full bg-accent-positive text-on-accent-positive flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-colors flex-shrink-0"
          aria-label={t('send')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
