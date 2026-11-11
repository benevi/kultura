// ============================================================
// KULTURA — Mensajes estables de los errores de /api/groups
// Van en `error.message` (el `code` es el del catálogo: forbidden,
// conflict…). Sin dependencias: lo importan servidor y cliente.
// ============================================================

export const GROUP_ERRORS = {
  /** Unirse: vetado por el dueño o grupo privado (F-11). */
  joinNotAllowed: 'join_not_allowed',
  /** El dueño no puede salir de su grupo. */
  ownerCannotLeave: 'owner_cannot_leave',
  /** Solo se invita a amigos. */
  notFriends: 'not_friends',
  cannotInviteSelf: 'cannot_invite_self',
  alreadyMember: 'already_member',
  invitationPending: 'invitation_pending',
  invitationResolved: 'invitation_resolved',
  cannotRemoveSelf: 'cannot_remove_self',
  cannotRemoveOwner: 'cannot_remove_owner',
  notAMember: 'not_a_member',
} as const
