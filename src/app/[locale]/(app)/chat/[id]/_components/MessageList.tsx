import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { MessageBubble } from './MessageBubble'
import type { Message } from './conversation'

interface Props {
  conversationId: string
  currentUserId: string
  /** Nombre del otro, para el de la región; `null` si salió del chat. */
  otherUsername: string | null
  messages: Message[]
  loading: boolean
  loadError: boolean
  announce: boolean
  hasMore: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onDeleted: (id: string) => void
  logRef: RefObject<HTMLDivElement | null>
  bottomRef: RefObject<HTMLDivElement | null>
}

/**
 * Mensajes — ACC-11: `role="log"` educado; los mensajes que llegan por
 * realtime se anuncian al añadirse, sin releer el historial.
 */
export function MessageList({
  conversationId,
  currentUserId,
  otherUsername,
  messages,
  loading,
  loadError,
  announce,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onDeleted,
  logRef,
  bottomRef,
}: Props) {
  const t = useTranslations('chat')

  return (
    <div
      ref={logRef}
      role="log"
      aria-live={announce ? 'polite' : 'off'}
      aria-relevant="additions"
      aria-label={otherUsername !== null ? t('logLabel', { username: otherUsername }) : t('logLabelFallback')}
      aria-busy={loading || undefined}
      tabIndex={0}
      className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
    >
      {!loading && hasMore && (
        <div className="flex justify-center">
          <KButton variant="secondary" size="sm" onClick={onLoadOlder} loading={loadingOlder}>
            {t('loadOlder')}
          </KButton>
        </div>
      )}
      {!loading && !loadError && messages.length === 0 && (
        <div className="text-center text-sm text-text-secondary py-8">
          {t('messagePlaceholder')}
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          conversationId={conversationId}
          message={msg}
          isMine={msg.sender_id === currentUserId}
          onDeleted={onDeleted}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
