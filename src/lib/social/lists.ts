// ============================================================
// KULTURA — Lists Queries (servidor)
// Uso exclusivo en Server Components.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbList, DbListItem, DbListMember, DbUser, DbMedia } from '@/types/supabase'
import type { List, ListItem, ListMember } from '@/types/list'
import type { MediaType } from '@/types/media'

// ── Row types ─────────────────────────────────────────────────────────────────

type ListRow = DbList & {
  owner: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
  item_count: number
}

type ListItemRow = DbListItem & {
  media: Pick<DbMedia, 'id' | 'title' | 'poster' | 'type' | 'year'> | null
  added_by_user: Pick<DbUser, 'id' | 'username'> | null
}

type ListMemberRow = DbListMember & {
  user: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapList(row: ListRow): List {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    mediaType: row.media_type as MediaType,
    isCollaborative: row.is_collaborative,
    createdAt: row.created_at,
    owner: row.owner
      ? {
          id: row.owner.id,
          username: row.owner.username,
          avatarColor: row.owner.avatar_color,
          avatarInitials: row.owner.avatar_initials,
          createdAt: '',
        }
      : undefined,
    itemCount: row.item_count,
  }
}

function mapListItem(row: ListItemRow): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    mediaId: row.media_id,
    addedBy: row.added_by ?? undefined,
    addedAt: row.added_at,
    media: row.media
      ? {
          id: row.media.id,
          externalId: row.media.id.split('_').slice(1).join('_'),
          type: row.media.type as MediaType,
          title: row.media.title,
          poster: row.media.poster ?? undefined,
          year: row.media.year ?? undefined,
        }
      : undefined,
  }
}

function mapMember(row: ListMemberRow): ListMember {
  return {
    listId: row.list_id,
    userId: row.user_id,
    user: row.user
      ? {
          id: row.user.id,
          username: row.user.username,
          avatarColor: row.user.avatar_color,
          avatarInitials: row.user.avatar_initials,
          createdAt: '',
        }
      : undefined,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Listas propias del usuario + listas donde es miembro.
 * Usa dos queries separadas y las combina (sin duplicados).
 */
export async function getUserLists(userId: string): Promise<List[]> {
  const supabase = createClient()

  // Listas propias
  const { data: ownedRaw, error: ownedErr } = await supabase
    .from('lists')
    .select('id, owner_id, name, media_type, is_collaborative, created_at, owner:owner_id(id, username, avatar_color, avatar_initials)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (ownedErr) throw new Error(`Failed to fetch owned lists: ${ownedErr.message}`)

  // Listas donde es miembro (no owner)
  const { data: memberRaw, error: memberErr } = await supabase
    .from('list_members')
    .select('list_id, list:list_id(id, owner_id, name, media_type, is_collaborative, created_at, owner:owner_id(id, username, avatar_color, avatar_initials))')
    .eq('user_id', userId)

  if (memberErr) throw new Error(`Failed to fetch member lists: ${memberErr.message}`)

  // Obtener item counts para todas las listas
  type RawListRow = Omit<ListRow, 'item_count'>
  const ownedRawTyped = (ownedRaw ?? []) as unknown as Array<RawListRow>
  const memberRawTyped = (memberRaw ?? []) as unknown as Array<{ list: RawListRow | null }>

  const allIds = [
    ...ownedRawTyped.map((r) => r.id),
    ...memberRawTyped.map((r) => r.list?.id).filter((id): id is string => Boolean(id)),
  ]

  const counts: Record<string, number> = {}
  if (allIds.length > 0) {
    const { data: countData } = await supabase
      .from('list_items')
      .select('list_id')
      .in('list_id', allIds)

    ;(countData ?? []).forEach((row: { list_id: string }) => {
      counts[row.list_id] = (counts[row.list_id] ?? 0) + 1
    })
  }

  const owned = ownedRawTyped.map((r) => mapList({ ...r, item_count: counts[r.id] ?? 0 }))
  const memberIds = new Set(owned.map((l) => l.id))
  const membered = memberRawTyped
    .map((r) => r.list)
    .filter((l): l is RawListRow => l !== null && !memberIds.has(l.id))
    .map((l) => mapList({ ...l, item_count: counts[l.id] ?? 0 }))

  return [...owned, ...membered]
}

/**
 * Detalle de una lista: items + miembros.
 */
export async function getListDetail(listId: string): Promise<{
  list: List
  items: ListItem[]
  members: ListMember[]
} | null> {
  const supabase = createClient()

  const { data: listRaw, error: listErr } = await supabase
    .from('lists')
    .select('id, owner_id, name, media_type, is_collaborative, created_at, owner:owner_id(id, username, avatar_color, avatar_initials)')
    .eq('id', listId)
    .maybeSingle()

  if (listErr) throw new Error(`Failed to fetch list: ${listErr.message}`)
  if (!listRaw) return null

  const [itemsRes, membersRes, countRes] = await Promise.all([
    supabase
      .from('list_items')
      .select('id, list_id, media_id, added_by, added_at, media:media_id(id, title, poster, type, year), added_by_user:added_by(id, username)')
      .eq('list_id', listId)
      .order('added_at', { ascending: false }),
    supabase
      .from('list_members')
      .select('list_id, user_id, user:user_id(id, username, avatar_color, avatar_initials)')
      .eq('list_id', listId),
    supabase
      .from('list_items')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId),
  ])

  if (itemsRes.error) throw new Error(`Failed to fetch list items: ${itemsRes.error.message}`)
  if (membersRes.error) throw new Error(`Failed to fetch list members: ${membersRes.error.message}`)

  const list = mapList({ ...(listRaw as unknown as ListRow), item_count: countRes.count ?? 0 })
  const items = (itemsRes.data as unknown as ListItemRow[]).map(mapListItem)
  const members = (membersRes.data as unknown as ListMemberRow[]).map(mapMember)

  return { list, items, members }
}

/**
 * Verifica si el usuario puede editar la lista (owner o miembro de colaborativa).
 */
export async function canEditList(listId: string, userId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: list } = await supabase
    .from('lists')
    .select('owner_id, is_collaborative')
    .eq('id', listId)
    .maybeSingle()

  if (!list) return false
  if (list.owner_id === userId) return true
  if (!list.is_collaborative) return false

  const { data: membership } = await supabase
    .from('list_members')
    .select('user_id')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!membership
}
