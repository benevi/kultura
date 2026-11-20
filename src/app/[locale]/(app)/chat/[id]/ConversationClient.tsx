'use client'

import { useState, useCallback } from 'react'
import { useUnreadChat } from '@/components/layout/UnreadChatProvider'
import { PushOffer } from '@/components/push/PushOffer'
import { ConversationHeader } from './_components/ConversationHeader'
import { LoadState } from './_components/LoadState'
import { MessageList } from './_components/MessageList'
import { MessageComposer } from './_components/MessageComposer'
import { useScrollToBottom } from './_components/useScrollToBottom'
import { useConversationMessages } from './_components/useConversationMessages'
import { useRealtimeMessages } from './_components/useRealtimeMessages'
import { useSendMessage } from './_components/useSendMessage'
import type { OtherUser } from './_components/conversation'

interface Props {
  conversationId: string
  otherUser: OtherUser | null
  currentUserId: string
  /**
   * F-11: false si ya no se puede escribir (no sois amigos, hay un bloqueo o
   * el otro salió). La base lo hace cumplir igualmente; esto solo lo explica.
   */
  canSend?: boolean
}

export function ConversationClient({
  conversationId,
  otherUser,
  currentUserId,
  canSend: initialCanSend = true,
}: Props) {
  const [canSend, setCanSend] = useState(initialCanSend)
  const { markConversationRead } = useUnreadChat()
  const { bottomRef, scrollToBottom } = useScrollToBottom()

  // Orden de los efectos: primero la carga, después la suscripción realtime.
  const {
    messages,
    setMessages,
    loading,
    loadError,
    announce,
    hasMore,
    loadingOlder,
    logRef,
    loadMessages,
    loadOlder,
  } = useConversationMessages({ conversationId, scrollToBottom, markConversationRead })

  useRealtimeMessages({ conversationId, currentUserId, setMessages, scrollToBottom, markConversationRead })

  const { text, setText, sending, handleSend } = useSendMessage({
    conversationId,
    currentUserId,
    setMessages,
    scrollToBottom,
    onCannotMessage: () => setCanSend(false),
  })

  const removeMessage = useCallback(
    (id: string) => setMessages(prev => prev.filter(m => m.id !== id)),
    [setMessages],
  )

  return (
    // Alto: pantalla menos la cabecera (56 px) y, en móvil, la BottomNav fija
    // (4rem + zona segura): así el campo de escribir nunca queda debajo.
    <div className="flex flex-col h-[calc(100dvh-56px-4rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-56px)]">
      <ConversationHeader
        conversationId={conversationId}
        otherUser={otherUser}
        onBlocked={() => setCanSend(false)}
      />

      <LoadState loading={loading} loadError={loadError} onRetry={loadMessages} />

      <MessageList
        conversationId={conversationId}
        currentUserId={currentUserId}
        otherUsername={otherUser ? otherUser.username : null}
        messages={messages}
        loading={loading}
        loadError={loadError}
        announce={announce}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
        onDeleted={removeMessage}
        logRef={logRef}
        bottomRef={bottomRef}
      />

      {/* Tras enviar un mensaje se ofrecen los avisos push: en el flujo,
          encima del campo de escribir (nunca lo tapa). */}
      <PushOffer placement="inline" />

      <MessageComposer
        canSend={canSend}
        text={text}
        onTextChange={setText}
        sending={sending}
        onSubmit={handleSend}
      />
    </div>
  )
}
