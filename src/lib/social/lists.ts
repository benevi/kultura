// ============================================================
// KULTURA — Lists Queries (servidor)
// Uso exclusivo en Server Components y Route Handlers.
//
// F-25: se leen también descripción, plantilla, orden manual y notas.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { LIST_COLUMNS } from '@/lib/social/lists-shared'
import type { DbList, DbListItem, DbListMember, DbUser, DbMedia } from '@/types/supabase'
import type { List, ListCover, ListItem, ListMediaType, ListMember, ListTemplate } from '@/types/list'
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

const OWNER_EMBED = 'owner:owner_id(id, username, avatar_color, avatar_initials)'
const ITEM_COLUMNS = 'id, list_id, media_id, added_by, added_at, position, note'
const ITEM_EMBEDS = 'media:media_id(id, title, poster, type, year), added_by_user:added_by(id, username)'

function toTemplate(value: unknown): ListTemplate | null {
  return value === 'franchise' || value === 'ranking' ? value : null
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapList(row: ListRow): List {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    mediaType: row.media_type as ListMediaType,
    isCollaborative: row.is_collaborative,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
    description: row.description ?? null,
    template: toTemplate(row.template),
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
    position: typeof row.position === 'number' ? row.position : null,
    note: row.note ?? null,
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

/**
 * Orden de una lista: el manual (`position`) y, sin él (antes de la migración
 * o filas sin número), lo más reciente primero, que es lo que se veía antes.
 */
export function sortListItems<T extends { position?: number | null; addedAt?: string | null }>(items: T[]): T[] {
  const time = (v?: string | null) => {
    const t = Date.parse(v ?? '')
    return Number.isFinite(t) ? t : -Infinity
  }
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const pa = typeof a.item.position === 'number' ? a.item.position : Infinity
      const pb = typeof b.item.position === 'number' ? b.item.position : Infinity
      if (pa !== pb) return pa - pb
      return time(b.item.addedAt) - time(a.item.addedAt) || a.i - b.i
    })
    .map(({ item }) => item)
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Portadas del mosaico del índice: las cuatro primeras de cada lista. */
const LIST_COVERS = 4

type CoverRow = {
  list_id: string
  position: number | null
  added_at: string | null
  media: Pick<DbMedia, 'title' | 'poster' | 'type'> | null
}

/**
 * Listas propias del usuario + listas donde es miembro.
 * Usa dos queries separadas y las combina (sin duplicados).
 *
 * Con `covers` (fase 8.5 L1, índice en «Sala»), la misma consulta que cuenta
 * los títulos trae también su orden y su portada, y cada lista lleva sus
 * cuatro primeros títulos en `covers`. Sin la opción, la consulta es la de
 * siempre.
 */
export async function getUserLists(userId: string, options: { covers?: boolean } = {}): Promise<List[]> {
  const supabase = await createClient()

  const fetchOwned = (columns: string) =>
    supabase
      .from('lists')
      .select(`${columns}, ${OWNER_EMBED}`)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
  const fetchMember = (columns: string) =>
    supabase
      .from('list_members')
      .select(`list_id, list:list_id(${columns}, ${OWNER_EMBED})`)
      .eq('user_id', userId)

  const [owned, member] = await Promise.all([fetchOwned(LIST_COLUMNS), fetchMember(LIST_COLUMNS)])

  if (owned.error) throw new Error(`Failed to fetch owned lists: ${owned.error.message}`)
  if (member.error) throw new Error(`Failed to fetch member lists: ${member.error.message}`)

  // Obtener item counts para todas las listas
  type RawListRow = Omit<ListRow, 'item_count'>
  const ownedRawTyped = (owned.data ?? []) as unknown as Array<RawListRow>
  const memberRawTyped = (member.data ?? []) as unknown as Array<{ list: RawListRow | null }>

  const allIds = [
    ...ownedRawTyped.map((r) => r.id),
    ...memberRawTyped.map((r) => r.list?.id).filter((id): id is string => Boolean(id)),
  ]

  const counts: Record<string, number> = {}
  const covers: Record<string, ListCover[]> = {}
  if (allIds.length > 0) {
    const { data: countData } = await supabase
      .from('list_items')
      .select(options.covers ? 'list_id, position, added_at, media:media_id(title, poster, type)' : 'list_id')
      .in('list_id', allIds)

    const rows = (countData ?? []) as unknown as CoverRow[]
    rows.forEach((row) => {
      counts[row.list_id] = (counts[row.list_id] ?? 0) + 1
    })
    if (options.covers) {
      const byList: Record<string, CoverRow[]> = {}
      rows.forEach((row) => {
        ;(byList[row.list_id] ??= []).push(row)
      })
      for (const [listId, items] of Object.entries(byList)) {
        covers[listId] = sortListItems(items.map((r) => ({ ...r, addedAt: r.added_at })))
          .filter((r) => r.media !== null)
          .slice(0, LIST_COVERS)
          .map((r) => ({ title: r.media!.title, poster: r.media!.poster ?? null, type: r.media!.type as MediaType }))
      }
    }
  }

  const withExtras = (l: List): List => (options.covers ? { ...l, covers: covers[l.id] ?? [] } : l)
  const ownedLists = ownedRawTyped.map((r) => withExtras(mapList({ ...r, item_count: counts[r.id] ?? 0 })))
  const memberIds = new Set(ownedLists.map((l) => l.id))
  const membered = memberRawTyped
    .map((r) => r.list)
    .filter((l): l is RawListRow => l !== null && !memberIds.has(l.id))
    .map((l) => withExtras(mapList({ ...l, item_count: counts[l.id] ?? 0 })))

  return [...ownedLists, ...membered]
}

/**
 * Detalle de una lista: items (en su orden) + miembros.
 */
export async function getListDetail(listId: string): Promise<{
  list: List
  items: ListItem[]
  members: ListMember[]
} | null> {
  const supabase = await createClient()

  const { data: listRaw, error: listErr } = await supabase
    .from('lists')
    .select(`${LIST_COLUMNS}, ${OWNER_EMBED}`)
    .eq('id', listId)
    .maybeSingle()

  if (listErr) throw new Error(`Failed to fetch list: ${listErr.message}`)
  if (!listRaw) return null

  const [itemsRes, membersRes] = await Promise.all([
    supabase
      .from('list_items')
      .select(`${ITEM_COLUMNS}, ${ITEM_EMBEDS}`)
      .eq('list_id', listId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('added_at', { ascending: false }),
    supabase
      .from('list_members')
      .select('list_id, user_id, user:user_id(id, username, avatar_color, avatar_initials)')
      .eq('list_id', listId),
  ])

  if (itemsRes.error) throw new Error(`Failed to fetch list items: ${itemsRes.error.message}`)
  if (membersRes.error) throw new Error(`Failed to fetch list members: ${membersRes.error.message}`)

  const items = sortListItems((itemsRes.data as unknown as ListItemRow[]).map(mapListItem))
  const list = mapList({ ...(listRaw as unknown as ListRow), item_count: items.length })
  const members = (membersRes.data as unknown as ListMemberRow[]).map(mapMember)

  return { list, items, members }
}

/** Lo que una ruta necesita saber de una lista para editarla. */
export interface ListAccess {
  exists: boolean
  canEdit: boolean
  isOwner: boolean
  mediaType: ListMediaType | null
}

/**
 * Permiso de edición (dueño, o miembro de una colaborativa) y formato de la
 * lista en dos lecturas como mucho. Lo que la RLS no deja leer no existe.
 */
export async function getListAccess(listId: string, userId: string): Promise<ListAccess> {
  const supabase = await createClient()

  const { data: list } = await supabase
    .from('lists')
    .select('owner_id, is_collaborative, media_type')
    .eq('id', listId)
    .maybeSingle()

  const row = list as { owner_id: string; is_collaborative: boolean | null; media_type: string } | null
  if (!row) return { exists: false, canEdit: false, isOwner: false, mediaType: null }
  const mediaType = row.media_type as ListMediaType
  if (row.owner_id === userId) return { exists: true, canEdit: true, isOwner: true, mediaType }
  if (!row.is_collaborative) return { exists: true, canEdit: false, isOwner: false, mediaType }

  const { data: membership } = await supabase
    .from('list_members')
    .select('user_id')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()

  return { exists: true, canEdit: Boolean(membership), isOwner: false, mediaType }
}

/**
 * Verifica si el usuario puede editar la lista (owner o miembro de colaborativa).
 */
export async function canEditList(listId: string, userId: string): Promise<boolean> {
  return (await getListAccess(listId, userId)).canEdit
}

/** Orden, notas y descripción de una lista pública (F-25). */
export interface PublicListExtras {
  description: string | null
  template: ListTemplate | null
  /** `media_id` → posición y nota. */
  items: Map<string, { position: number | null; note: string | null }>
}

/**
 * Lo que la página pública necesita además de `getPublicList` (que es de
 * otro módulo): se pide EN PARALELO con ella, solo por `listId`. La RLS
 * (can_read_list) ya limita a listas públicas para quien no es dueño ni
 * miembro, y la página solo lo usa si `getPublicList` confirma que la lista
 * es pública y de ese usuario. `null` si no se puede leer.
 */
export async function getPublicListExtras(listId: string): Promise<PublicListExtras | null> {
  const supabase = await createClient()
  const [listRes, itemsRes] = await Promise.all([
    supabase.from('lists').select('description, template').eq('id', listId).eq('is_public', true).maybeSingle(),
    supabase.from('list_items').select('media_id, position, note').eq('list_id', listId),
  ])
  if (listRes.error || itemsRes.error || !listRes.data) return null
  const meta = listRes.data as { description?: string | null; template?: string | null }
  const items = new Map<string, { position: number | null; note: string | null }>()
  for (const row of (itemsRes.data ?? []) as Array<{ media_id: string; position: number | null; note: string | null }>) {
    items.set(row.media_id, { position: typeof row.position === 'number' ? row.position : null, note: row.note ?? null })
  }
  return { description: meta.description ?? null, template: toTemplate(meta.template), items }
}
