import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergeIncoming, type Message } from './conversation'

interface Options {
  conversationId: string
  currentUserId: string
  setMessages: Dispatch<SetStateAction<Message[]>>
  scrollToBottom: () => void
  markConversationRead: (conversationId: string) => void
}

/** Mensajes nuevos por realtime (Supabase), con el perfil de quien escribe. */
export function useRealtimeMessages({
  conversationId,
  currentUserId,
  setMessages,
  scrollToBottom,
  markConversationRead,
}: Options) {
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
            .eq('id', newMsg.sender_id ?? '') // un INSERT siempre trae autor
            .maybeSingle()

          const fullMsg: Message = {
            ...newMsg,
            users: senderData ?? null,
          }
          // Sin duplicar el añadido al enviar; el eco propio reemplaza al
          // temporal si llega antes que la respuesta del POST.
          setMessages(prev => mergeIncoming(prev, fullMsg, currentUserId))
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
  }, [conversationId, scrollToBottom, currentUserId, markConversationRead, setMessages])
}
