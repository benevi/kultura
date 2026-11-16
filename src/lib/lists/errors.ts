// ============================================================
// KULTURA — Mensajes estables de /api/lists (saneamiento 7)
// Sin dependencias: lo importan tanto el servidor como los componentes.
// ============================================================

/** Mensajes estables que el cliente distingue dentro de su `code`. */
export const LIST_ERRORS = {
  /** `forbidden`: solo se puede invitar a amigos. */
  notFriends: 'not_friends',
  /** `invalid_input` (field `mediaId`): el formato no cabe en esta lista. */
  typeMismatch: 'type_mismatch',
  /** `invalid_input`: la lista no es colaborativa. */
  notCollaborative: 'not_collaborative',
} as const
