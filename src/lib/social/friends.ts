// ============================================================
// KULTURA — Friends Queries (servidor)
// Helpers server-side para consultar friendships en Supabase.
// Uso exclusivo en Server Components, Route Handlers y Server Actions.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbFriendship, DbUser } from '@/types/supabase'
import type { Friendship, UserProfile } from '@/types/user'

type FriendshipWithUser = DbFriendship & {
  requester: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
  receiver: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
}

function mapUser(
  u: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'>
): UserProfile {
  return {
    id: u.id,
    username: u.username,
    avatarColor: u.avatar_color,
    avatarInitials: u.avatar_initials,
    createdAt: '',
  }
}

function mapFriendship(row: FriendshipWithUser, currentUserId: string): Friendship {
  const isRequester = row.requester_id === currentUserId
  const otherRaw = isRequester ? row.receiver : row.requester
  return {
    id: row.id,
    requesterId: row.requester_id,
    receiverId: row.receiver_id,
    status: row.status as 'pending' | 'accepted',
    createdAt: row.created_at,
    otherUser: otherRaw ? mapUser(otherRaw) : undefined,
  }
}

/**
 * Devuelve las amistades aceptadas del usuario (ambas direcciones).
 */
export async function getFriends(userId: string): Promise<Friendship[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, receiver_id, status, created_at, requester:requester_id(id, username, avatar_color, avatar_initials), receiver:receiver_id(id, username, avatar_color, avatar_initials)'
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch friends: ${error.message}`)

  return (data as unknown as FriendshipWithUser[]).map((row) =>
    mapFriendship(row, userId)
  )
}

/**
 * Devuelve las solicitudes de amistad entrantes pendientes del usuario.
 */
export async function getPendingRequests(userId: string): Promise<Friendship[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, receiver_id, status, created_at, requester:requester_id(id, username, avatar_color, avatar_initials), receiver:receiver_id(id, username, avatar_color, avatar_initials)'
    )
    .eq('status', 'pending')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false })

  if (error) return []

  return (data as unknown as FriendshipWithUser[]).map((row) =>
    mapFriendship(row, userId)
  )
}

/**
 * Estado de la relación de amistad entre dos usuarios.
 * Comprueba ambas direcciones.
 */
export type FriendshipStatusResult =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted'

export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<FriendshipStatusResult> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id, status')
    .or(
      `and(requester_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
    )
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch friendship status: ${error.message}`)
  if (!data) return 'none'

  const row = data as Pick<DbFriendship, 'requester_id' | 'receiver_id' | 'status'>
  if (row.status === 'accepted') return 'accepted'
  if (row.requester_id === currentUserId) return 'pending_sent'
  return 'pending_received'
}
