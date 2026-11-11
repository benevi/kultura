// ============================================================
// KULTURA — Cliente de /api/groups (saneamiento 6 y 7)
// Devuelven `data` o lanzan `ApiError` (con `code`, `message` y `status`).
// ============================================================

import { apiFetch } from '@/lib/api/client'

export interface GroupSummary {
  id: string
  ownerId: string
  name: string
  description: string | null
  coverColor: string
  icon: string | null
  isPublic: boolean
  createdAt: string
  memberRole?: string
}

export interface DiscoverGroupCard {
  id: string
  ownerId: string
  name: string
  description: string | null
  coverColor: string
  icon: string | null
  createdAt: string
  memberCount: number
  isMember: boolean
}

export interface InvitableFriend {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
}

export interface GroupCreateBody {
  name: string
  description?: string
  is_public?: boolean
  icon?: string | null
}

export interface DiscoverQuery {
  q?: string
  scope: 'all' | 'joined' | 'unjoined'
  size: 'all' | 'small' | 'medium' | 'large'
  limit: number
  offset: number
}

const group = (id: string) => `/api/groups/${encodeURIComponent(id)}`

/** Crea un grupo: vuelve con `memberRole: 'owner'`. */
export function createGroup(body: GroupCreateBody): Promise<GroupSummary> {
  return apiFetch('/api/groups', { method: 'POST', json: body })
}

export function discoverGroups(query: DiscoverQuery): Promise<DiscoverGroupCard[]> {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  params.set('scope', query.scope)
  params.set('size', query.size)
  params.set('limit', String(query.limit))
  params.set('offset', String(query.offset))
  return apiFetch(`/api/groups/discover?${params.toString()}`)
}

/** Entra o sale (si ya es miembro). */
export function toggleGroupMembership(groupId: string): Promise<{ joined: boolean }> {
  return apiFetch(`${group(groupId)}/join`, { method: 'POST' })
}

export function fetchInvitableFriends(groupId: string): Promise<InvitableFriend[]> {
  return apiFetch(`${group(groupId)}/invitations`)
}

export async function inviteToGroup(groupId: string, inviteeId: string): Promise<void> {
  await apiFetch(`${group(groupId)}/invitations`, { method: 'POST', json: { inviteeId } })
}

/** Aceptar (PATCH) o rechazar (DELETE) una invitación. */
export async function respondToGroupInvitation(invitationId: string, action: 'accept' | 'reject'): Promise<void> {
  await apiFetch(`/api/groups/invitations/${encodeURIComponent(invitationId)}`, {
    method: action === 'accept' ? 'PATCH' : 'DELETE',
  })
}

export async function createGroupPost(groupId: string, content: string): Promise<void> {
  await apiFetch(`${group(groupId)}/posts`, { method: 'POST', json: { content } })
}

export async function deleteGroupPost(groupId: string, postId: string): Promise<void> {
  await apiFetch(`${group(groupId)}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' })
}

/** El dueño expulsa a un miembro (F-11). */
export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await apiFetch(`${group(groupId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}
