import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/client'
import { sendChatMessage } from '@/lib/chat/client'
import { CHAT_ERRORS } from '@/lib/chat/errors'
import { useToastContext } from '@/components/ui/ToastProvider'
import { offerPushInContext } from '@/lib/push/offer'
import { TEMP_PREFIX, type Message } from './conversation'

interface Options {
  conversationId: string
  currentUserId: string
  setMessages: Dispatch<SetStateAction<Message[]>>
  scrollToBottom: () => void
  /** F-11: el servidor dice que ya no se puede escribir. */
  onCannotMessage: () => void
}

/** Campo de escribir y envío optimista (se reconcilia con la respuesta). */
export function useSendMessage({
  conversationId,
  currentUserId,
  setMessages,
  scrollToBottom,
  onCannotMessage,
}: Options) {
  const t = useTranslations('chat')
  const { show } = useToastContext()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)

    const content = text.trim()
    setText('')

    // Optimistic add
    const tempId = `${TEMP_PREFIX}${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      content,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      users: null,
    }
    setMessages(prev => [...prev, tempMsg])
    setTimeout(scrollToBottom, 50)

    try {
      const real = await sendChatMessage(conversationId, content)
      // Reconcile: replace the optimistic temp message with the real one (id UUID from server)
      const realMsg: Message = { ...real, users: null }
      setMessages(prev => prev.map(m => (m.id === tempId ? realMsg : m)))
      // Mensaje enviado: buen momento para ofrecer los avisos de respuesta
      // (PushOffer decide si hay algo que ofrecer; una vez por visita).
      offerPushInContext('chat')
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(content)
      if (err instanceof ApiError && err.code === 'forbidden' && err.message === CHAT_ERRORS.cannotMessage) {
        // F-11: ya no sois amigos o hay un bloqueo; se explica en lugar del campo.
        onCannotMessage()
      } else {
        show({ message: t('sendError'), type: 'error' })
      }
    }

    setSending(false)
  }

  return { text, setText, sending, handleSend }
}
