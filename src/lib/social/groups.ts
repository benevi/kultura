// ============================================================
// KULTURA — Groups Queries (servidor)
// Uso exclusivo en Server Components y Route Handlers.
// Espejo de src/lib/social/lists.ts — extrae lógica inline de:
//   - src/app/api/groups/route.ts (GET)
//   - src/app/api/groups/[id]/join/route.ts
//   - src/app/[locale]/(app)/groups/[id]/page.tsx
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbGroup, DbGroupMember, DbUser } from '@/types/supabase'

// ── Row types ─────────────────────────────────────────────────────────────────

type GroupRow = DbGroup & {
  memberRole?: string
}

type GroupMemberRow = DbGroupMember & {
  users: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface Group {
  id: string
  ownerId: string
  name: string
  description: string | null
  coverColor: string
  createdAt: string
  memberRole?: string
}

export interface GroupMember {
  groupId: string
  userId: string
  role: 'owner' | 'member'
  joinedAt: string
  user: {
    id: string
    username: string
    avatarColor: string
    avatarInitials: string
  } | null
}

/** Grupo en la pestaña "Descubrir": metadata + nº de miembros + si ya soy miembro. */
export interface DiscoverGroup {
  id: string
  ownerId: string
  name: string
  description: string | null
  coverColor: string
  createdAt: string
  memberCount: number
  isMember: boolean
}

export type DiscoverScope = 'all' | 'joined' | 'unjoined'
export type DiscoverSize = 'all' | 'small' | 'medium' | 'large'

export interface DiscoverGroupsParams {
  q?: string
  scope?: DiscoverScope
  size?: DiscoverSize
  limit?: number
  offset?: number
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    coverColor: row.cover_color,
    createdAt: row.created_at,
    memberRole: row.memberRole,
  }
}

function mapMember(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    user: row.users
      ? {
          id: row.users.id,
          username: row.users.username,
          avatarColor: row.users.avatar_color,
          avatarInitials: row.users.avatar_initials,
        }
      : null,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Grupos a los que el usuario pertenece (como owner o miembro).
 * Incluye el rol del usuario en cada grupo.
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, role, groups(id, name, description, cover_color, created_at, owner_id)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch user groups: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    group_id: string
    role: string
    groups: Omit<GroupRow, 'memberRole'> | null
  }>)
    .filter((row) => row.groups !== null)
    .map((row) => mapGroup({ ...(row.groups as Omit<GroupRow, 'memberRole'>), memberRole: row.role }))
}

/**
 * Metadata de un grupo por su ID. Retorna null si no existe.
 */
export async function getGroupById(groupId: string): Promise<Group | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('groups')
    .select('id, name, description, cover_color, created_at, owner_id')
    .eq('id', groupId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch group: ${error.message}`)
  if (!data) return null

  return mapGroup(data as unknown as GroupRow)
}

/**
 * Miembros de un grupo con info de perfil. Máximo 20, ordenados por join date.
 */
export async function getGroupMembers(groupId: string, limit = 20): Promise<GroupMember[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, role, joined_at, users(id, username, avatar_color, avatar_initials)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch group members: ${error.message}`)

  return ((data ?? []) as unknown as GroupMemberRow[]).map(mapMember)
}

/**
 * Rol del usuario en el grupo. Retorna null si no es miembro.
 */
export async function getMemberRole(
  groupId: string,
  userId: string
): Promise<'owner' | 'member' | null> {
  const supabase = createClient()

  const { data } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  return (data?.role as 'owner' | 'member') ?? null
}

/**
 * Boolean: ¿el usuario es miembro (cualquier rol) del grupo?
 */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  return (await getMemberRole(groupId, userId)) !== null
}

/**
 * Boolean: ¿el usuario es owner del grupo?
 */
export async function isGroupOwner(groupId: string, userId: string): Promise<boolean> {
  return (await getMemberRole(groupId, userId)) === 'owner'
}

// ── Discover ────────────────────────────────────────────────────────────────

/** Fila de groups con join anidado a group_members (solo user_id). */
interface DiscoverGroupQueryRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  cover_color: string
  created_at: string
  group_members: { user_id: string }[] | null
}

function inSizeBucket(count: number, size: DiscoverSize): boolean {
  switch (size) {
    case 'small':
      return count >= 1 && count <= 10
    case 'medium':
      return count >= 11 && count <= 50
    case 'large':
      return count > 50
    default:
      return true
  }
}

/**
 * Grupos para la pestaña "Descubrir" mediante queries directas PostgREST.
 *
 * Reemplaza el RPC get_discoverable_groups: el schema cache de PostgREST en
 * Supabase Cloud no recargaba la función (ver migración DEPRECATED). Trae los
 * grupos con un join anidado a group_members y deriva memberCount/isMember,
 * filtros (scope/size) y paginación en JS. El límite se recorta a [1, 50].
 */
export async function getDiscoverableGroups(
  params: DiscoverGroupsParams = {}
): Promise<DiscoverGroup[]> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Failed to fetch discoverable groups: not authenticated')

  const q = params.q?.trim()
  const scope: DiscoverScope = params.scope ?? 'all'
  const size: DiscoverSize = params.size ?? 'all'
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 50)
  const offset = Math.max(params.offset ?? 0, 0)

  let query = supabase
    .from('groups')
    .select('id, owner_id, name, description, cover_color, created_at, group_members(user_id)')
    .order('created_at', { ascending: false })

  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch discoverable groups: ${error.message}`)

  const mapped: DiscoverGroup[] = ((data ?? []) as unknown as DiscoverGroupQueryRow[]).map(
    (row) => {
      const members = row.group_members ?? []
      return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        description: row.description,
        coverColor: row.cover_color,
        createdAt: row.created_at,
        memberCount: members.length,
        isMember: members.some((m) => m.user_id === user.id),
      }
    }
  )

  return mapped
    .filter((g) => {
      if (scope === 'joined' && !g.isMember) return false
      if (scope === 'unjoined' && g.isMember) return false
      return inSizeBucket(g.memberCount, size)
    })
    .sort((a, b) =>
      b.memberCount !== a.memberCount
        ? b.memberCount - a.memberCount
        : b.createdAt.localeCompare(a.createdAt)
    )
    .slice(offset, offset + limit)
}
