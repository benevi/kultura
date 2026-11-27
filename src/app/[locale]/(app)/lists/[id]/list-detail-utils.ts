// ============================================================
// KULTURA — /lists/[id]: utilidades puras del detalle de una lista.
// ============================================================

import type { List, ListMember } from '@/types/list'

/** Amigo de quien mira la lista, tal como lo pasa la página. */
export interface ListFriend {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
}

export const DESCRIPTION_MAX = 500

/** Ruta pública de la lista, o `null` si no llega el dueño embebido. */
export function publicListPath(list: Pick<List, 'id' | 'owner'>): string | null {
  return list.owner ? `/u/${list.owner.username}/l/${list.id}` : null
}

/**
 * Quién puede ver los miembros de una colaborativa: su dueño y sus miembros.
 * A los demás (también con una lista pública) no se les enseñan ni se les
 * mandan (riesgo R1 de la auditoría de Listas).
 */
export function canSeeListMembers(
  list: Pick<List, 'ownerId'>,
  members: Pick<ListMember, 'userId'>[],
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId) return false
  return viewerId === list.ownerId || members.some((m) => m.userId === viewerId)
}

/** Amigos que aún no están en la lista (ni son el dueño). */
export function invitableFriends(members: ListMember[], ownerId: string, friends: ListFriend[]): ListFriend[] {
  const memberIds = new Set(members.map((m) => m.userId))
  memberIds.add(ownerId)
  return friends.filter((f) => !memberIds.has(f.id))
}

/** Miembro nuevo a partir del amigo invitado. */
export function memberFromFriend(listId: string, friend: ListFriend): ListMember {
  return {
    listId,
    userId: friend.id,
    user: { id: friend.id, username: friend.username, avatarColor: friend.avatarColor, avatarInitials: friend.avatarInitials, createdAt: '' },
  }
}
