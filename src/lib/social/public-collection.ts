// ============================================================
// KULTURA — Colección pública (/u/{username})
// Listas que su dueño ha marcado como públicas, legibles sin sesión.
//
// El filtro `is_public = true` va EXPLÍCITO aunque la RLS ya lo imponga a
// quien no es dueño: el dueño que mira su propia página puede leer también
// sus listas privadas, y aquí debe ver exactamente lo que ve un visitante.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbMedia, DbUser } from '@/types/supabase'
import type { MediaType } from '@/types/media'

/** Orden de los formatos en la página: el mismo que el resto de la app. */
export const COLLECTION_FORMAT_ORDER: MediaType[] = [
  'movie', 'tv', 'anime', 'manga', 'book', 'comic', 'game',
]

export interface PublicCollectionItem {
  mediaId: string
  title: string
  poster: string | null
  type: string
  year?: number
}

export interface PublicList {
  id: string
  name: string
  mediaType: MediaType
  items: PublicCollectionItem[]
}

export interface PublicOwner {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
  avatarIcon: string | null
  bio: string | null
}

export interface PublicCollection {
  owner: PublicOwner
  lists: PublicList[]
}

type OwnerRow = Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials' | 'avatar_icon'> & {
  bio?: string | null
}

type ItemRow = {
  list_id: string
  media_id: string
  media: Pick<DbMedia, 'id' | 'title' | 'poster' | 'type' | 'year'> | null
}

function mapOwner(row: OwnerRow): PublicOwner {
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    avatarInitials: row.avatar_initials,
    avatarIcon: row.avatar_icon ?? null,
    bio: row.bio ?? null,
  }
}

function mapItem(row: ItemRow): PublicCollectionItem {
  return {
    mediaId: row.media_id,
    title: row.media?.title ?? '',
    poster: row.media?.poster ?? null,
    type: row.media?.type ?? row.media_id.split('_')[0],
    year: row.media?.year ?? undefined,
  }
}

/** Ordena por formato (COLLECTION_FORMAT_ORDER) y conserva el orden de llegada dentro de cada uno. */
export function sortByFormat<T extends { mediaType: MediaType }>(lists: T[]): T[] {
  const rank = (t: MediaType) => {
    const i = COLLECTION_FORMAT_ORDER.indexOf(t)
    return i === -1 ? COLLECTION_FORMAT_ORDER.length : i
  }
  return lists
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l.mediaType) - rank(b.l.mediaType) || a.i - b.i)
    .map(({ l }) => l)
}

async function getOwner(username: string): Promise<OwnerRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_color, avatar_initials, avatar_icon, bio')
    .eq('username', username)
    .maybeSingle()
  return (data as OwnerRow | null) ?? null
}

/**
 * Colección pública de un usuario. `null` si el usuario no existe.
 * Las listas públicas vacías se omiten: una fila sin títulos parece rota.
 */
export async function getPublicCollection(username: string): Promise<PublicCollection | null> {
  const ownerRow = await getOwner(username)
  if (!ownerRow) return null

  const supabase = createClient()
  const { data: listRows, error: listErr } = await supabase
    .from('lists')
    .select('id, name, media_type, created_at')
    .eq('owner_id', ownerRow.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (listErr) throw new Error(`Failed to fetch public lists: ${listErr.message}`)

  const lists = (listRows ?? []) as Array<{ id: string; name: string; media_type: string }>
  if (lists.length === 0) return { owner: mapOwner(ownerRow), lists: [] }

  const { data: itemRows, error: itemsErr } = await supabase
    .from('list_items')
    .select('list_id, media_id, media:media_id(id, title, poster, type, year)')
    .in('list_id', lists.map((l) => l.id))
    .order('added_at', { ascending: false })

  if (itemsErr) throw new Error(`Failed to fetch public list items: ${itemsErr.message}`)

  const byList = new Map<string, PublicCollectionItem[]>()
  for (const row of (itemRows ?? []) as unknown as ItemRow[]) {
    const bucket = byList.get(row.list_id) ?? []
    bucket.push(mapItem(row))
    byList.set(row.list_id, bucket)
  }

  const publicLists = lists
    .map((l) => ({
      id: l.id,
      name: l.name,
      mediaType: l.media_type as MediaType,
      items: byList.get(l.id) ?? [],
    }))
    .filter((l) => l.items.length > 0)

  return { owner: mapOwner(ownerRow), lists: sortByFormat(publicLists) }
}

/** Una lista pública concreta, solo si es de `username`. */
export async function getPublicList(
  username: string,
  listId: string,
): Promise<{ owner: PublicOwner; list: PublicList } | null> {
  const ownerRow = await getOwner(username)
  if (!ownerRow) return null

  const supabase = createClient()
  const { data: listRow } = await supabase
    .from('lists')
    .select('id, name, media_type')
    .eq('id', listId)
    .eq('owner_id', ownerRow.id)
    .eq('is_public', true)
    .maybeSingle()

  if (!listRow) return null
  const l = listRow as { id: string; name: string; media_type: string }

  const { data: itemRows, error: itemsErr } = await supabase
    .from('list_items')
    .select('list_id, media_id, media:media_id(id, title, poster, type, year)')
    .eq('list_id', l.id)
    .order('added_at', { ascending: false })

  if (itemsErr) throw new Error(`Failed to fetch public list items: ${itemsErr.message}`)

  return {
    owner: mapOwner(ownerRow),
    list: {
      id: l.id,
      name: l.name,
      mediaType: l.media_type as MediaType,
      items: ((itemRows ?? []) as unknown as ItemRow[]).map(mapItem),
    },
  }
}

/**
 * Nombre actual de quien se llamaba `oldUsername` (R11 / ROJO-6), o `null`.
 * Lo resuelve `public.username_redirect` (SECURITY DEFINER), así la tabla del
 * historial no se puede listar. Sin la migración de F-12 la función no existe
 * y devuelve `null` (un 404 de los de siempre).
 */
export async function resolveRenamedUsername(oldUsername: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('username_redirect', { p_username: oldUsername })
  if (error || typeof data !== 'string' || !data || data === oldUsername) return null
  return data
}

/** ¿Tiene el usuario al menos una lista pública? (para enseñar "Compartir colección") */
export async function hasPublicLists(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { count } = await supabase
    .from('lists')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('is_public', true)
  return (count ?? 0) > 0
}
