'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { InlineConfirm, ReportButton, useRestoreFocus } from '@/components/social/ReportButton'
import { blockUser, deleteMessage, leaveConversation } from '@/lib/social/actions'
import { createClient } from '@/lib/supabase/client'
import { useToastContext } from '@/components/ui/ToastProvider'
import { useUnreadChat } from '@/components/layout/UnreadChatProvider'
import { offerPushInContext } from '@/lib/push/offer'
import { PushOffer } from '@/components/push/PushOffer'

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
  /** F-11 (MODERATION_V2): denunciar mensajes, borrar los propios, bloquear y salir. */
  moderation?: boolean
  /**
   * F-11: false si ya no se puede escribir (no sois amigos, hay un bloqueo o
   * el otro salió). La base lo hace cumplir igualmente; esto solo lo explica.
   */
  canSend?: boolean
}

/** Papelera rellena (borrar un mensaje propio). */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="3" y="4.5" width="18" height="3" rx="1.5" />
      <rect x="9" y="2" width="6" height="3" rx="1.5" />
      <path d="M5.5 9h13l-1.1 11.1A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.9z" />
    </svg>
  )
}

/** Opciones de la conversación: denunciar y bloquear al otro, salir del chat. */
function ConversationOptions({
  conversationId,
  otherUser,
  onBlocked,
}: {
  conversationId: string
  otherUser: OtherUser | null
  onBlocked: () => void
}) {
  const t = useTranslations('moderation')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'block' | 'leave' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const { ref: toggleRef, restore } = useRestoreFocus()
  const panelId = useId()

  function cancel() {
    setConfirm(null)
    setError(null)
    restore()
  }

  async function handleBlock() {
    if (!otherUser) return
    setBusy(true)
    setError(null)
    try {
      await blockUser(otherUser.id)
      setBlocked(true)
      setConfirm(null)
      onBlocked()
    } catch {
      setError(t('blockError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError(null)
    try {
      await leaveConversation(conversationId)
      router.push('/chat')
    } catch {
      setError(t('leaveError'))
      setBusy(false)
    }
  }

  return (
    <div className="ml-auto relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setOpen((v) => !v); setConfirm(null); setError(null) }}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <span className="sr-only">{t('conversationOptions')}</span>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
          <circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" />
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !confirm) {
              setOpen(false)
              toggleRef.current?.focus()
            }
          }}
          className="absolute right-0 top-12 z-20 w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2 p-3 bg-surface-elevated border border-surface-border rounded-2xl shadow-soft"
        >
          {confirm === 'block' ? (
            <InlineConfirm
              title={t('blockConfirmTitle')}
              body={t('blockConfirmBody')}
              confirmLabel={t('block')}
              cancelLabel={t('cancel')}
              loading={busy}
              error={error}
              onConfirm={handleBlock}
              onCancel={cancel}
            />
          ) : confirm === 'leave' ? (
            <InlineConfirm
              title={t('leaveConfirmTitle')}
              body={t('leaveConfirmBody')}
              confirmLabel={t('leave')}
              cancelLabel={t('cancel')}
              loading={busy}
              error={error}
              onConfirm={handleLeave}
              onCancel={cancel}
            />
          ) : (
            <>
              {otherUser && (
                <ReportButton targetType="user" targetId={otherUser.id} contextLabel={otherUser.username} />
              )}
              {otherUser && !blocked && (
                <KButton
                  variant="secondary"
                  size="sm"
                  className="justify-start text-xs text-text-tertiary hover:text-accent-danger hover:border-accent-danger"
                  onClick={() => setConfirm('block')}
                >
                  {t('blockUser', { username: otherUser.username })}
                </KButton>
              )}
              {blocked && <p role="status" className="text-xs text-text-secondary">{t('blockedNotice')}</p>}
              <KButton
                variant="secondary"
                size="sm"
                className="justify-start text-xs text-text-tertiary hover:text-accent-danger hover:border-accent-danger"
                onClick={() => setConfirm('leave')}
              >
                {t('leave')}
              </KButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Acción por mensaje: denunciar (ajeno) o borrar (propio, con confirmación). */
function MessageActions({
  conversationId,
  message,
  isMine,
  onDeleted,
}: {
  conversationId: string
  message: Message
  isMine: boolean
  onDeleted: (id: string) => void
}) {
  const t = useTranslations('moderation')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ref: triggerRef, restore } = useRestoreFocus()

  if (message.id.startsWith('temp-')) return null

  if (!isMine) {
    return (
      <ReportButton
        variant="icon"
        targetType="message"
        targetId={message.id}
        contextLabel={message.users?.username}
      />
    )
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteMessage(conversationId, message.id)
      onDeleted(message.id)
    } catch {
      setError(t('deleteMessageError'))
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <InlineConfirm
        title={t('deleteMessageConfirmTitle')}
        body={t('deleteMessageConfirmBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        loading={busy}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirming(false)
          setError(null)
          restore()
        }}
      />
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={t('deleteMessage')}
      onClick={() => setConfirming(true)}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-text-tertiary hover:text-accent-danger hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  )
}

function timeLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function ConversationClient({
  conversationId,
  otherUser,
  currentUserId,
  moderation = false,
  canSend: initialCanSend = true,
}: Props) {
  const t = useTranslations('chat')
  const tm = useTranslations('moderation')
  const locale = useLocale()
  const [canSend, setCanSend] = useState(initialCanSend)
  const { show } = useToastContext()
  const { markConversationRead } = useUnreadChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // El historial entra con la región callada; a partir de ahí, cada mensaje
  // nuevo se anuncia (si no, al abrir el chat se leería entero).
  const [announce, setAnnounce] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ACC-19: el desplazamiento suave respeta `prefers-reduced-motion` (la
  // regla global de CSS no alcanza a `scrollIntoView` desde JS).
  const scrollToBottom = useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  // Load messages
  const loadMessages = useCallback(() => {
    setLoading(true)
    setAnnounce(false)
    setLoadError(false)
    fetch(`/api/chat/${conversationId}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setLoading(false)
        setTimeout(() => setAnnounce(true), 0)
        setTimeout(scrollToBottom, 50)
        // E96: el GET marca leído en servidor fire-and-forget; este update
        // awaited + refetch garantiza que el badge global baje al abrir.
        markConversationRead(conversationId)
      })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [conversationId, scrollToBottom, markConversationRead])

  useEffect(() => { loadMessages() }, [loadMessages])

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
          // E96: mensaje ajeno recibido con el chat abierto → marcar leído
          // para que no cuente en el badge global de no-leídos.
          if (fullMsg.sender_id !== currentUserId) {
            markConversationRead(conversationId)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, scrollToBottom, currentUserId, markConversationRead])

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
      const err = await res.json().catch(() => ({})) as { error?: string }
      if (res.status === 403 && err.error === 'cannot_message') {
        // F-11: ya no sois amigos o hay un bloqueo; se explica en lugar del campo.
        setCanSend(false)
      } else {
        show({ message: t('sendError'), type: 'error' })
      }
    } else {
      // Reconcile: replace the optimistic temp message with the real one (id UUID from server)
      const { message: real } = await res.json().catch(() => ({ message: null }))
      if (real) {
        const realMsg: Message = { ...real, users: null }
        setMessages(prev => prev.map(m => (m.id === tempId ? realMsg : m)))
      }
      // Mensaje enviado: buen momento para ofrecer los avisos de respuesta
      // (PushOffer decide si hay algo que ofrecer; una vez por visita).
      offerPushInContext('chat')
    }

    setSending(false)
  }

  return (
    // Alto: pantalla menos la cabecera (56 px) y, en móvil, la BottomNav fija
    // (4rem + zona segura): así el campo de escribir nunca queda debajo.
    <div className="flex flex-col h-[calc(100dvh-56px-4rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-56px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-default">
        <Link
          href="/chat"
          aria-label={t('backToChats')}
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
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
          <span className="text-sm text-text-secondary">{moderation ? t('otherLeft') : '...'}</span>
        )}
        {moderation && (
          <ConversationOptions
            conversationId={conversationId}
            otherUser={otherUser}
            onBlocked={() => setCanSend(false)}
          />
        )}
      </div>

      {/* Estado de carga y errores: fuera del log, para que este solo anuncie
          mensajes nuevos. */}
      {loading && (
        <p role="status" className="text-center text-sm text-text-secondary py-8">{t('loadingMessages')}</p>
      )}
      {!loading && loadError && (
        <div role="alert" className="text-center py-8 flex flex-col items-center gap-3">
            <p className="text-sm text-text-secondary">{t('loadError')}</p>
          <button
            type="button"
            onClick={loadMessages}
            className="min-h-11 px-4 py-1.5 rounded-full bg-surface-elevated border border-surface-border text-sm text-text-primary hover:bg-surface-default transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Messages — ACC-11: `role="log"` educado; los mensajes que llegan
          por realtime se anuncian al añadirse, sin releer el historial. */}
      <div
        role="log"
        aria-live={announce ? 'polite' : 'off'}
        aria-relevant="additions"
        aria-label={otherUser ? t('logLabel', { username: otherUser.username }) : t('logLabelFallback')}
        aria-busy={loading || undefined}
        tabIndex={0}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      >
        {!loading && !loadError && messages.length === 0 && (
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
                {/* En los recibidos, el nombre de quien escribe acompaña al
                    avatar: sin él solo se veían unas iniciales sueltas. */}
                {!isMine && msg.users?.username && (
                  <span className="text-xs font-semibold text-text-secondary px-1">
                    {msg.users.username}
                  </span>
                )}
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-bento ${
                    isMine
                      ? 'bg-accent-pink text-on-accent-pink font-medium rounded-br-lg'
                      : 'bg-surface-elevated text-text-primary rounded-bl-lg'
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-xs text-text-secondary px-1">
                    {timeLabel(msg.created_at, locale)}
                  </span>
                  {moderation && (
                    <MessageActions
                      conversationId={conversationId}
                      message={msg}
                      isMine={isMine}
                      onDeleted={(id) => setMessages(prev => prev.filter(m => m.id !== id))}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Tras enviar un mensaje se ofrecen los avisos push: en el flujo,
          encima del campo de escribir (nunca lo tapa). */}
      <PushOffer placement="inline" />

      {/* Input — F-11: si ya no se puede escribir, se explica por qué. */}
      {!canSend ? (
        <p
          role="status"
          className="px-4 py-4 border-t border-surface-border bg-surface-default text-sm text-text-secondary text-center"
        >
          {tm('cannotMessage')}
        </p>
      ) : (
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-4 py-3 border-t border-surface-border bg-surface-default"
      >
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('messagePlaceholder')}
          aria-label={t('messageLabel')}
          maxLength={2000}
          enterKeyHint="send"
          className="flex-1 min-h-11 bg-surface-elevated border border-field-border rounded-full px-4 py-2 text-base md:text-sm text-text-primary placeholder-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-11 h-11 rounded-full bg-accent-pink text-on-accent-pink flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-colors flex-shrink-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          aria-label={t('send')}
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </form>
      )}
    </div>
  )
}
