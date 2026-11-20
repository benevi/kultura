// ============================================================
// KULTURA — /chat/[id]: tipos y utilidades puras de la conversación.
// ============================================================

export interface Message {
  id: string
  content: string
  /** `null`: la cuenta del autor se borró (el texto llega vacío). */
  sender_id: string | null
  created_at: string
  users: {
    username: string
    avatar_color: string
    avatar_initials: string
  } | null
}

export interface OtherUser {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

/** Prefijo de los mensajes optimistas (aún sin id del servidor). */
export const TEMP_PREFIX = 'temp-'

export function isTempMessage(message: Pick<Message, 'id'>): boolean {
  return message.id.startsWith(TEMP_PREFIX)
}

export function timeLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** Página anterior: va arriba, sin repetir los que ya están. */
export function prependOlder(prev: Message[], older: Message[]): Message[] {
  const seen = new Set(prev.map(m => m.id))
  return [...older.filter(m => !seen.has(m.id)), ...prev]
}

/**
 * Mensaje llegado por realtime. Si ya está (añadido al enviar), no cambia
 * nada; si es propio y aún queda su temporal (el eco llegó antes que la
 * respuesta del POST), lo reemplaza; si no, va al final.
 */
export function mergeIncoming(prev: Message[], incoming: Message, currentUserId: string): Message[] {
  if (prev.some(m => m.id === incoming.id)) return prev
  if (incoming.sender_id === currentUserId) {
    const i = prev.findIndex(m => isTempMessage(m) && m.content === incoming.content)
    if (i !== -1) {
      const c = [...prev]
      c[i] = incoming
      return c
    }
  }
  return [...prev, incoming]
}
