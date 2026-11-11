// ============================================================
// KULTURA — Servicio de grupos (saneamiento 6.3)
// La lógica que antes vivía en los handlers de /api/groups/**. No sabe de
// HTTP: recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
// Las lecturas compartidas con las páginas siguen en `lib/social/groups.ts`.
//
// F-11 (MODERATION_V2): expulsar miembros y que el dueño borre posts
// ajenos; sin la bandera, expulsar responde `not_found` (`moderation_disabled`).
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { isModerationV2, isRlsDenied } from '@/lib/social/friends'
import {
  createGroupRow,
  getDiscoverableGroups,
  getGroupById,
  getInvitableFriends,
  getMemberRole,
  getUserGroups,
  mapGroup,
  type DiscoverGroup,
  type DiscoverGroupsParams,
  type Group,
  type InvitableFriend,
} from '@/lib/social/groups'
import { GROUP_ERRORS } from '@/lib/groups/errors'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import type { DbGroupInvitation } from '@/types/supabase'

const log = createLogger('groups/service')

/** Mensaje del `not_found` de lo que necesita MODERATION_V2. */
export const MODERATION_DISABLED = 'moderation_disabled'

/** Color por defecto de un grupo nuevo (se remapea al leer, ver mapGroup). */
const DEFAULT_COVER = '#E82020'

export interface GroupInvitation {
  id: string
  groupId: string
  inviterId: string
  inviteeId: string
  status: 'pending' | 'accepted'
  createdAt: string
}

/** Las lecturas de `lib/social/groups` lanzan: aquí pasan a `internal`. */
async function guarded<T>(what: string, fn: () => Promise<T>): Promise<ServiceResult<T>> {
  try {
    return success(await fn())
  } catch (err) {
    log.error(`Failed to ${what}`, { err })
    return failure('internal', { message: `Failed to ${what}` })
  }
}

// ── Grupos ───────────────────────────────────────────────────────────────────

/** Mis grupos (dueño o miembro), con mi rol. */
export function listMyGroups(userId: string): Promise<ServiceResult<Group[]>> {
  return guarded('load groups', () => getUserGroups(userId))
}

export interface GroupCreateInput {
  name: string
  description?: string
  cover_color?: string
  is_public: boolean
  icon?: string | null
}

/** Crea un grupo; el disparador `on_group_created` da de alta al dueño. */
export async function createGroup(userId: string, input: GroupCreateInput): Promise<ServiceResult<Group>> {
  const { group, error } = await createGroupRow({
    owner_id: userId,
    name: input.name,
    description: input.description || null,
    cover_color: input.cover_color ?? DEFAULT_COVER,
    is_public: input.is_public,
    // Solo si el usuario eligió icono: mandar una columna que no existe (sin
    // la migración de `groups.icon`) es un error duro, no un no-op.
    ...(input.icon ? { icon: input.icon } : {}),
  })
  if (error || !group) {
    log.error('Failed to create group', { err: error })
    return failure('internal', { message: 'Failed to create group' })
  }
  return success(mapGroup({ ...group, memberRole: 'owner' }))
}

/** Pestaña «Descubrir». */
export function discoverGroups(params: DiscoverGroupsParams): Promise<ServiceResult<DiscoverGroup[]>> {
  return guarded('discover groups', () => getDiscoverableGroups(params))
}

/** Entra en el grupo o, si ya es miembro, sale. El dueño no puede salir. */
export async function toggleMembership(
  supabase: SupabaseClient,
  userId: string,
  groupId: string
): Promise<ServiceResult<{ joined: boolean }>> {
  const group = await guarded('load group', () => getGroupById(groupId))
  if (!group.ok) return group
  if (!group.value) return failure('not_found', { message: 'Group not found' })

  const role = await getMemberRole(groupId, userId)
  if (role === 'owner') return failure('forbidden', { message: GROUP_ERRORS.ownerCannotLeave })

  if (role) {
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
    if (error) {
      log.error('Failed to leave group', { code: error.code, message: error.message })
      return failure('internal', { message: 'Failed to leave group' })
    }
    return success({ joined: false })
  }

  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' })
  // F-11: la RLS rechaza la entrada (vetado, o grupo privado): «no puedes», no un fallo.
  if (isRlsDenied(error)) return failure('forbidden', { message: GROUP_ERRORS.joinNotAllowed })
  if (error) {
    log.error('Failed to join group', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to join group' })
  }
  return success({ joined: true })
}

// ── Invitaciones ─────────────────────────────────────────────────────────────

/** Amigos del dueño que se pueden invitar (ni miembros ni con invitación pendiente). */
export async function listInvitableFriends(
  userId: string,
  groupId: string
): Promise<ServiceResult<InvitableFriend[]>> {
  if ((await getMemberRole(groupId, userId)) !== 'owner') return failure('forbidden', { message: 'Owner only' })
  return guarded('load invitable friends', () => getInvitableFriends(groupId, userId))
}

/** El dueño invita a un amigo: crea la invitación y la notificación `group_invite`. */
export async function inviteFriend(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  inviteeId: string
): Promise<ServiceResult<GroupInvitation>> {
  if (inviteeId === userId) {
    return failure('invalid_input', { message: GROUP_ERRORS.cannotInviteSelf, field: 'inviteeId' })
  }

  const group = await guarded('load group', () => getGroupById(groupId))
  if (!group.ok) return group
  if (!group.value) return failure('not_found', { message: 'Group not found' })
  if ((await getMemberRole(groupId, userId)) !== 'owner') return failure('forbidden', { message: 'Owner only' })

  // Ids ya validados como uuid: se pueden interpolar en el filtro.
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${userId},receiver_id.eq.${inviteeId}),and(requester_id.eq.${inviteeId},receiver_id.eq.${userId})`
    )
    .limit(1)
    .maybeSingle()
  if (!friendship) return failure('forbidden', { message: GROUP_ERRORS.notFriends })

  if ((await getMemberRole(groupId, inviteeId)) !== null) {
    return failure('conflict', { message: GROUP_ERRORS.alreadyMember })
  }

  const { data: existing } = await supabase
    .from('group_invitations')
    .select('id')
    .eq('group_id', groupId)
    .eq('invitee_id', inviteeId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return failure('conflict', { message: GROUP_ERRORS.invitationPending })

  const { data: row, error } = await supabase
    .from('group_invitations')
    .insert({ group_id: groupId, inviter_id: userId, invitee_id: inviteeId })
    .select('id, group_id, inviter_id, invitee_id, status, created_at')
    .single()
  if (error || !row) {
    log.error('Failed to create invitation', { code: error?.code, message: error?.message })
    return failure('internal', { message: 'Failed to create invitation' })
  }
  const invitation = row as DbGroupInvitation

  // Notificación (best-effort, como en las listas).
  const { data: sender } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
  const { error: notifErr } = await createAdminClient().from('notifications').insert({
    user_id: inviteeId,
    type: 'group_invite',
    payload: {
      groupId,
      groupName: group.value.name,
      invitationId: invitation.id,
      fromUserId: userId,
      fromUsername: (sender as { username?: string } | null)?.username ?? '',
    },
  })
  if (notifErr) log.error('[E83] notif insert failed', { type: 'group_invite', notifErr })

  return success({
    id: invitation.id,
    groupId: invitation.group_id,
    inviterId: invitation.inviter_id,
    inviteeId: invitation.invitee_id,
    status: invitation.status,
    createdAt: invitation.created_at,
  })
}

/**
 * Acepta una invitación (solo el invitado). La RLS lo restringe al invitado y
 * el disparador `on_invitation_accepted` da el alta. Marca leída la notificación.
 */
export async function acceptInvitation(
  supabase: SupabaseClient,
  userId: string,
  invitationId: string
): Promise<ServiceResult<null>> {
  // RLS: solo la ven el que invita y el invitado.
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('id, invitee_id, status')
    .eq('id', invitationId)
    .maybeSingle()
  if (!invitation) return failure('not_found', { message: 'Invitation not found' })
  if (invitation.invitee_id !== userId) return failure('forbidden', { message: 'Invitee only' })
  if (invitation.status !== 'pending') return failure('conflict', { message: GROUP_ERRORS.invitationResolved })

  const { error, count } = await supabase
    .from('group_invitations')
    .update({ status: 'accepted' }, { count: 'exact' })
    .eq('id', invitationId)
    .eq('status', 'pending')
  if (error) {
    log.error('Failed to accept invitation', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to accept invitation' })
  }
  if (count === 0) return failure('conflict', { message: GROUP_ERRORS.invitationResolved })

  // El payload jsonb guarda invitationId al crearla. Best-effort.
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'group_invite')
    .eq('payload->>invitationId', invitationId)
  return success(null)
}

/** Rechaza (el invitado) o retira (el que invita) una invitación, y borra su notificación. */
export async function rejectInvitation(
  supabase: SupabaseClient,
  userId: string,
  invitationId: string
): Promise<ServiceResult<null>> {
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('id, inviter_id, invitee_id')
    .eq('id', invitationId)
    .maybeSingle()
  if (!invitation) return failure('not_found', { message: 'Invitation not found' })
  if (invitation.invitee_id !== userId && invitation.inviter_id !== userId) {
    return failure('forbidden', { message: 'Not part of this invitation' })
  }

  const { error, count } = await supabase
    .from('group_invitations')
    .delete({ count: 'exact' })
    .eq('id', invitationId)
  if (error) {
    log.error('Failed to reject invitation', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to reject invitation' })
  }
  if (count === 0) return failure('not_found', { message: 'Invitation not found' })

  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', invitation.invitee_id)
    .eq('type', 'group_invite')
    .eq('payload->>invitationId', invitationId)
  return success(null)
}

// ── Moderación ───────────────────────────────────────────────────────────────

/**
 * El dueño expulsa a un miembro (F-11). Se le veta (`group_bans`) para que no
 * vuelva a entrar solo en un grupo público; el dueño puede volver a invitarle.
 */
export async function removeMember(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  targetId: string
): Promise<ServiceResult<null>> {
  if (!isModerationV2()) return failure('not_found', { message: MODERATION_DISABLED })
  if (targetId === userId) return failure('invalid_input', { message: GROUP_ERRORS.cannotRemoveSelf })

  const [myRole, targetRole] = await Promise.all([getMemberRole(groupId, userId), getMemberRole(groupId, targetId)])
  if (myRole !== 'owner') return failure('forbidden', { message: 'Owner only' })
  if (targetRole === null) return failure('not_found', { message: GROUP_ERRORS.notAMember })
  if (targetRole === 'owner') return failure('invalid_input', { message: GROUP_ERRORS.cannotRemoveOwner })

  // El veto expulsa por disparador (handle_new_group_ban).
  const { error: banError } = await supabase
    .from('group_bans')
    .upsert(
      { group_id: groupId, user_id: targetId, banned_by: userId },
      { onConflict: 'group_id,user_id', ignoreDuplicates: true }
    )
  if (banError) {
    log.error('group ban failed', { code: banError.code, message: banError.message })
    return failure('internal', { message: 'Failed to remove member' })
  }

  // Y el DELETE directo (política «Group owners can remove members»), por si
  // el disparador o la tabla de vetos faltaran.
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId)
  if (error) {
    log.error('group member remove failed', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to remove member' })
  }

  if ((await getMemberRole(groupId, targetId)) !== null) return failure('forbidden', { message: 'Not removed' })
  return success(null)
}

// ── Posts ────────────────────────────────────────────────────────────────────

/** Publica en el grupo. Quién puede (miembro, sin veto) lo decide la RLS. */
export async function createPost(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  content: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.from('group_posts').insert({ group_id: groupId, user_id: userId, content })
  if (isRlsDenied(error)) return failure('forbidden', { message: 'Cannot post in this group' })
  if (error) {
    log.error('Failed to post', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to post' })
  }
  return success(null)
}

/** El autor borra su post y, con MODERATION_V2, el dueño borra cualquiera. */
export async function deletePost(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  postId: string
): Promise<ServiceResult<null>> {
  const { data: post } = await supabase
    .from('group_posts')
    .select('id, user_id')
    .eq('id', postId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!post) return failure('not_found', { message: 'Post not found' })

  if ((post as { user_id: string }).user_id !== userId) {
    const role = isModerationV2() ? await getMemberRole(groupId, userId) : null
    if (role !== 'owner') return failure('forbidden', { message: 'Author or owner only' })
  }

  // RETURNING: un DELETE que la RLS filtra no da error, solo no borra nada.
  const { data, error } = await supabase
    .from('group_posts')
    .delete()
    .eq('id', postId)
    .eq('group_id', groupId)
    .select('id')
  if (error) {
    log.error('Failed to delete post', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to delete post' })
  }
  if (!data || data.length === 0) return failure('forbidden', { message: 'Not deleted' })
  return success(null)
}
