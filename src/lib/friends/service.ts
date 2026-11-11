// ============================================================
// KULTURA — Servicio de amistades y bloqueos (saneamiento 6.3)
// La lógica que antes vivía en /api/friends y /api/friends/blocks. No sabe
// de HTTP: recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
//
// F-11 (MODERATION_V2): con bloqueo en cualquier sentido la RLS rechaza la
// solicitud; se responde `forbidden` sin decir que hay un bloqueo.
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { uuidSchema } from '@/lib/api/contracts/common'
import {
  getBlockedUsers,
  hasBlocked,
  isModerationV2,
  isRlsDenied,
  type BlockedProfile,
} from '@/lib/social/friends'
import { failure, success, type ServiceResult } from '@/lib/api/result'

const log = createLogger('friends/service')

/** Mensaje del `not_found` de bloquear sin MODERATION_V2. */
export const MODERATION_DISABLED = 'moderation_disabled'

const FRIENDSHIP_COLUMNS = 'id, requester_id, receiver_id, status, created_at'

interface Profile {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

export interface FriendEntry {
  friendshipId: string
  user: Profile
}

export interface FriendshipRow {
  id: string
  requester_id: string
  receiver_id: string
  status: string
  created_at: string
}

/** Filtro PostgREST de la pareja en cualquier sentido (ids ya validados como uuid). */
function pair(a: string, b: string): string {
  return `and(requester_id.eq.${a},receiver_id.eq.${b}),and(requester_id.eq.${b},receiver_id.eq.${a})`
}

// ── /api/friends ─────────────────────────────────────────────────────────────

/** Amistades aceptadas, con el perfil del otro (para RecommendModal). */
export async function listFriends(supabase: SupabaseClient, userId: string): Promise<ServiceResult<FriendEntry[]>> {
  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, receiver_id, requester:requester_id(id, username, avatar_color, avatar_initials), receiver:receiver_id(id, username, avatar_color, avatar_initials)'
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
  if (error) {
    log.error('Failed to fetch friends', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to fetch friends' })
  }

  type Row = { id: string; requester_id: string; receiver_id: string; requester: Profile | null; receiver: Profile | null }
  const friends: FriendEntry[] = []
  for (const row of (data ?? []) as unknown as Row[]) {
    const other = row.requester_id === userId ? row.receiver : row.requester
    if (other) friends.push({ friendshipId: row.id, user: other })
  }
  return success(friends)
}

/** Pide amistad. `conflict` si ya hay una relación en cualquier sentido. */
export async function sendRequest(
  supabase: SupabaseClient,
  userId: string,
  receiverId: string
): Promise<ServiceResult<FriendshipRow>> {
  if (receiverId === userId) {
    return failure('invalid_input', { field: 'receiverId', message: 'Cannot send friend request to yourself' })
  }

  const { data: receiver } = await supabase.from('users').select('id').eq('id', receiverId).maybeSingle()
  if (!receiver) return failure('not_found', { field: 'receiverId', message: 'User not found' })

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(pair(userId, receiverId))
    .maybeSingle()
  if (existing) return failure('conflict', { message: 'Friendship already exists' })

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, receiver_id: receiverId, status: 'pending' })
    .select(FRIENDSHIP_COLUMNS)
    .single()
  // F-11: la RLS la rechaza si hay un bloqueo; no se dice cuál es el motivo.
  if (isRlsDenied(error)) return failure('forbidden')
  // Saneamiento 3.1: la otra persona mandó la suya a la vez (única por pareja).
  if (error?.code === '23505') return failure('conflict', { message: 'Friendship already exists' })
  if (error || !data) {
    log.error('Failed to send friend request', { code: error?.code, message: error?.message })
    return failure('internal', { message: 'Failed to send friend request' })
  }
  return success(data as FriendshipRow)
}

/** Acepta (devuelve la amistad) o rechaza (la borra, `null`). Solo quien la recibe. */
export async function respondRequest(
  supabase: SupabaseClient,
  userId: string,
  friendshipId: string,
  action: 'accept' | 'decline'
): Promise<ServiceResult<FriendshipRow | null>> {
  const { data } = await supabase
    .from('friendships')
    .select('id, receiver_id, status')
    .eq('id', friendshipId)
    .maybeSingle()
  const friendship = data as { receiver_id: string; status: string } | null
  if (!friendship) return failure('not_found', { message: 'Friendship not found' })
  if (friendship.receiver_id !== userId) return failure('forbidden')
  if (friendship.status !== 'pending') return failure('conflict', { message: 'Friendship is not pending' })

  if (action === 'decline') {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
    if (error) {
      log.error('Failed to decline request', { code: error.code, message: error.message })
      return failure('internal', { message: 'Failed to decline request' })
    }
    return success(null)
  }

  const { data: accepted, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select(FRIENDSHIP_COLUMNS)
    .single()
  if (error || !accepted) {
    log.error('Failed to accept request', { code: error?.code, message: error?.message })
    return failure('internal', { message: 'Failed to accept request' })
  }
  return success(accepted as FriendshipRow)
}

/** Quita una amistad (o retira una solicitud). Cualquiera de los dos. */
export async function removeFriendship(
  supabase: SupabaseClient,
  userId: string,
  friendshipId: string
): Promise<ServiceResult<null>> {
  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id')
    .eq('id', friendshipId)
    .maybeSingle()
  const friendship = data as { requester_id: string; receiver_id: string } | null
  if (!friendship) return failure('not_found', { message: 'Friendship not found' })
  if (friendship.requester_id !== userId && friendship.receiver_id !== userId) return failure('forbidden')

  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) {
    log.error('Failed to remove friend', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to remove friend' })
  }
  return success(null)
}

// ── /api/friends/blocks (F-11) ───────────────────────────────────────────────

/** ¿He bloqueado a `otherId`? Sin MODERATION_V2, `enabled: false`. */
export async function readBlockState(
  userId: string,
  otherId: string
): Promise<ServiceResult<{ enabled: boolean; blocked: boolean }>> {
  if (!isModerationV2()) return success({ enabled: false, blocked: false })
  // Un id raro o el propio no es un error: simplemente no está bloqueado.
  if (!uuidSchema.safeParse(otherId).success || otherId === userId) return success({ enabled: true, blocked: false })
  try {
    return success({ enabled: true, blocked: await hasBlocked(userId, otherId) })
  } catch (err) {
    log.error('blocks read failed', { err })
    return failure('internal', { message: 'Failed to read blocks' })
  }
}

/** A quién he bloqueado. Sin MODERATION_V2, `enabled: false` y nadie. */
export async function listBlocked(
  userId: string
): Promise<ServiceResult<{ enabled: boolean; users: BlockedProfile[] }>> {
  if (!isModerationV2()) return success({ enabled: false, users: [] })
  try {
    return success({ enabled: true, users: await getBlockedUsers(userId) })
  } catch (err) {
    log.error('blocks read failed', { err })
    return failure('internal', { message: 'Failed to read blocks' })
  }
}

/** Bloquea (la base borra la amistad y las invitaciones). Bloquear dos veces no es error. */
export async function block(supabase: SupabaseClient, userId: string, otherId: string): Promise<ServiceResult<null>> {
  if (!isModerationV2()) return failure('not_found', { message: MODERATION_DISABLED })
  if (otherId === userId) return failure('invalid_input', { field: 'userId', message: 'Cannot block yourself' })

  const { data: target } = await supabase.from('users').select('id').eq('id', otherId).maybeSingle()
  if (!target) return failure('not_found', { field: 'userId', message: 'User not found' })

  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: userId, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
  if (error) {
    log.error('block failed', { err: error })
    return failure('internal', { message: 'Failed to block' })
  }

  // La base ya lo hace con el disparador; aquí también, por si faltara (la
  // política friendships_delete_own lo permite a cualquiera de los dos).
  await supabase.from('friendships').delete().or(pair(userId, otherId))
  return success(null)
}

/** Desbloquea (la amistad no vuelve: hay que pedirla). */
export async function unblock(supabase: SupabaseClient, userId: string, otherId: string): Promise<ServiceResult<null>> {
  if (!isModerationV2()) return failure('not_found', { message: MODERATION_DISABLED })
  if (otherId === userId) return failure('invalid_input', { field: 'userId', message: 'Cannot unblock yourself' })

  const { error } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId)
  if (error) {
    log.error('unblock failed', { err: error })
    return failure('internal', { message: 'Failed to unblock' })
  }
  return success(null)
}
