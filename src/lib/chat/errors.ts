// ============================================================
// KULTURA — Mensajes estables de /api/chat (saneamiento 7)
// Sin dependencias: lo importan tanto el servidor como los componentes.
// ============================================================

/** Mensajes estables que el cliente distingue dentro de `forbidden`. */
export const CHAT_ERRORS = {
  /** Abrir una conversación con quien no es amigo (E93). */
  notFriends: 'not_friends',
  /** La RLS rechaza el mensaje: ya no sois amigos o hay un bloqueo (F-11). */
  cannotMessage: 'cannot_message',
} as const
