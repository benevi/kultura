import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fetchMessages } from '@/lib/chat/client'
import { useToastContext } from '@/components/ui/ToastProvider'
import { prependOlder, type Message } from './conversation'

interface Options {
  conversationId: string
  scrollToBottom: () => void
  markConversationRead: (conversationId: string) => void
}

/** Mensajes de la conversación: carga inicial, reintento y página anterior. */
export function useConversationMessages({ conversationId, scrollToBottom, markConversationRead }: Options) {
  const t = useTranslations('chat')
  const { show } = useToastContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // El historial entra con la región callada; a partir de ahí, cada mensaje
  // nuevo se anuncia (si no, al abrir el chat se leería entero).
  const [announce, setAnnounce] = useState(false)
  // Saneamiento 1.3: el GET trae los últimos 100; los anteriores, a petición.
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(() => {
    setLoading(true)
    setAnnounce(false)
    setLoadError(false)
    fetchMessages(conversationId)
      .then(d => {
        setMessages(d.messages as Message[])
        setHasMore(d.hasMore === true)
        setLoading(false)
        setTimeout(() => setAnnounce(true), 0)
        setTimeout(scrollToBottom, 50)
        // E96: el GET marca leído en servidor fire-and-forget; este POST
        // /api/chat/[id]/read awaited + refetch garantiza que el badge baje al abrir.
        markConversationRead(conversationId)
      })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [conversationId, scrollToBottom, markConversationRead])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Página anterior: se añade arriba sin mover lo que se está leyendo.
  const loadOlder = useCallback(async () => {
    const oldest = messages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    try {
      const d = await fetchMessages(conversationId, oldest.created_at)
      const older = d.messages as Message[]
      const el = logRef.current
      const prevHeight = el?.scrollHeight ?? 0
      setMessages(prev => prependOlder(prev, older))
      setHasMore(d.hasMore === true)
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevHeight
      })
    } catch {
      show({ message: t('loadError'), type: 'error' })
    } finally {
      setLoadingOlder(false)
    }
  }, [messages, loadingOlder, conversationId, show, t])

  return {
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
  }
}
