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
  const supabase = await createClient()

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
  const supabase = await createClient()

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
  const supabase = await createClient()

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

// ── Moderación (F-11) ─────────────────────────────────────────────────────────

/**
 * MODERATION_V2=1 la activa Víctor tras aplicar 20261101110001_moderation.sql.
 * Sin ella la UI oculta bloquear, salir, expulsar y los tipos nuevos de
 * denuncia, y todo lo demás funciona como antes.
 */
export function isModerationV2(): boolean {
  return process.env.MODERATION_V2?.trim() === '1'
}

/** Errores de "la migración todavía no está aplicada" (tabla, columna o función que falta). */
const NOT_MIGRATED_CODES = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isNotMigratedError(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED_CODES.has(error.code ?? '')
}

/** La RLS rechazó la escritura (insufficient_privilege). */
export function isRlsDenied(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42501'
}

export interface BlockedProfile {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
}

/**
 * Usuarios que `userId` ha bloqueado. `null` si la tabla aún no existe (antes
 * de la migración): quien llama lo trata como "moderación no disponible".
 */
export async function getBlockedUsers(userId: string): Promise<BlockedProfile[] | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, blocked:blocked_id(id, username, avatar_color, avatar_initials)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isNotMigratedError(error)) return null
    throw new Error(`Failed to fetch blocked users: ${error.message}`)
  }

  type Row = { blocked: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null }
  const rows = (data ?? []) as unknown as Row[]
  const out: BlockedProfile[] = []
  for (const row of rows) {
    if (!row.blocked) continue
    out.push({
      id: row.blocked.id,
      username: row.blocked.username,
      avatarColor: row.blocked.avatar_color,
      avatarInitials: row.blocked.avatar_initials,
    })
  }
  return out
}

/**
 * ¿`userId` ha bloqueado a `otherId`? (Solo se ve el bloqueo propio: quien está
 * bloqueado no puede leer la fila.) `null` si la tabla aún no existe.
 */
export async function hasBlocked(userId: string, otherId: string): Promise<boolean | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .eq('blocked_id', otherId)
    .maybeSingle()

  if (error) {
    if (isNotMigratedError(error)) return null
    throw new Error(`Failed to fetch block: ${error.message}`)
  }
  return data !== null
}
