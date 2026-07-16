'use client'

// ============================================================
// KULTURA — UnreadChatProvider (E96)
// Contexto global del badge de mensajes no leídos.
// Count inicial vía /api/chat?countOnly=1 + suscripción realtime
// a INSERT en messages (sin filtro; RLS limita a mis conversaciones).
// Al recibir un mensaje ajeno fuera de la conversación abierta se
// refetchea el count (no incremento local: robusto ante carreras).
// ============================================================

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'

interface UnreadChatContextValue {
  unreadCount: number
  refreshUnread: () => Promise<void>
  /** Marca la conversación como leída (update directo, policy propia) y refetchea el badge. */
  markConversationRead: (conversationId: string) => Promise<void>
}

const UnreadChatContext = createContext<UnreadChatContextValue>({
  unreadCount: 0,
  refreshUnread: async () => {},
  markConversationRead: async () => {},
})

export function useUnreadChat(): UnreadChatContextValue {
  return useContext(UnreadChatContext)
}

interface Props {
  userId: string
  children: React.ReactNode
}

export function UnreadChatProvider({ userId, children }: Props) {
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  // Ref para leer el pathname actual dentro del callback realtime sin resuscribir.
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?countOnly=1')
      if (!res.ok) return
      const { count } = await res.json()
      if (typeof count === 'number') setUnreadCount(count)
    } catch {
      // silencioso: el badge conserva el último valor conocido
    }
  }, [])

  const markConversationRead = useCallback(async (conversationId: string) => {
    const supabase = createClient()
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    await refreshUnread()
  }, [userId, refreshUnread])

  // Count inicial
  useEffect(() => { refreshUnread() }, [refreshUnread])

  // Suscripción realtime global.
  //
  // El JWT tiene que estar aplicado al socket ANTES del phx_join: el join
  // usa el token CACHEADO (socket.accessTokenValue), un canal que se une
  // como anon queda SUBSCRIBED pero WALRUS descarta todos los eventos, y un
  // access_token enviado después NO re-autoriza la suscripción
  // postgres_changes ya creada. Además supabase-js solo propaga el token en
  // SIGNED_IN/TOKEN_REFRESHED (nunca en INITIAL_SESSION, la sesión
  // restaurada de cookies). Por tanto: (1) no suscribir hasta TENER token,
  // (2) await de setAuth antes de subscribe, (3) onAuthStateChange
  // (INITIAL_SESSION incluido) como fuente de token + refresco continuo.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let disposed = false
    let subscribing = false

    const subscribeWithToken = async (token: string) => {
      if (disposed) return
      if (channel || subscribing) {
        // Canal ya creado (o creándose): solo mantener el token del socket al día.
        if (channel) await supabase.realtime.setAuth(token)
        return
      }
      subscribing = true
      await supabase.realtime.setAuth(token)
      if (disposed) {
        subscribing = false
        return
      }

      channel = supabase
        .channel(`unread-messages:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const msg = payload.new as { conversation_id: string; sender_id: string }
            if (msg.sender_id === userId) return
            // Conversación abierta: ConversationClient la marca leída; no cuenta.
            if (pathnameRef.current === `/chat/${msg.conversation_id}`) return
            refreshUnread()
          }
        )
        .subscribe()
      subscribing = false
    }

    // Fuente 1: eventos de auth (INITIAL_SESSION incluido). Registrado antes
    // de cualquier subscribe para no perder el primer evento con sesión.
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) subscribeWithToken(session.access_token)
    })

    // Fuente 2: sesión ya disponible en el momento del mount (por si
    // INITIAL_SESSION disparó antes de registrar el listener).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) subscribeWithToken(session.access_token)
    })

    return () => {
      disposed = true
      authSub.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId, refreshUnread])

  return (
    <UnreadChatContext.Provider value={{ unreadCount, refreshUnread, markConversationRead }}>
      {children}
    </UnreadChatContext.Provider>
  )
}
