// ============================================================
// KULTURA — Perfil público (/u/{username})
//
// Dos fuentes, con permisos distintos:
//  - Las LISTAS públicas (`is_public = true`): las ve cualquiera, también sin
//    sesión. El filtro va EXPLÍCITO aunque la RLS ya lo imponga a quien no es
//    dueño: el dueño que mira su propia página puede leer también sus listas
//    privadas, y aquí debe ver exactamente lo que ve un visitante.
//  - La BIBLIOTECA (favoritos, contadores, "viendo ahora"): solo si quien mira
//    puede leerla (D-04b). Sin sesión nunca (la RLS de W1 no deja a anon leer
//    `user_media` y Ajustes promete "sin cuenta no la ve nadie"); con sesión,
//    lo decide `can_read_library` (F-12). Antes de esa migración rige la
//    política de W1: cualquiera con sesión.
//
// REN-6: el dueño, sus listas públicas y sus títulos salen en UNA consulta
// anidada (antes eran tres en serie) y se memoiza por render, así que la
// página, sus metadatos y la imagen OG comparten la misma lectura. Si la
// consulta anidada fallara (relación ambigua, PostgREST antiguo…), se vuelve
// a las tres consultas de siempre: la página nunca se queda sin datos.
// ============================================================

import * as React from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { DbMedia, DbUser } from '@/types/supabase'
import type { MediaType } from '@/types/media'

/** Orden de los formatos en la página: el mismo que el resto de la app. */
export const COLLECTION_FORMAT_ORDER: MediaType[] = [
  'movie', 'tv', 'anime', 'manga', 'book', 'comic', 'game',
]

export type LibraryVisibility = 'public' | 'friends' | 'private'

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
  /** Alta en KULTURA (ISO). Solo con sesión (`getOwnerDetails`). */
  createdAt?: string | null
  /**
   * Solo con sesión (`getOwnerDetails`). `null`: sin sesión (anon no puede
   * leer la columna) o la migración de F-12 aún no está aplicada.
   */
  libraryVisibility?: LibraryVisibility | null
}

export interface PublicCollection {
  owner: PublicOwner
  lists: PublicList[]
}

type OwnerRow = Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials' | 'avatar_icon'> & {
  bio?: string | null
  created_at?: string | null
  library_visibility?: string | null
}

type MediaEmbed = Pick<DbMedia, 'id' | 'title' | 'poster' | 'type' | 'year'> | null

type ItemRow = {
  list_id?: string
  media_id: string
  added_at?: string | null
  media: MediaEmbed
}

type NestedListRow = {
  id: string
  name: string
  media_type: string
  created_at?: string | null
  list_items?: ItemRow[] | null
}

type NestedOwnerRow = OwnerRow & { lists?: NestedListRow[] | null }

/**
 * Memoización POR RENDER (página + metadatos + imagen OG). `cache()` solo
 * existe en el build de servidor de React; en los tests es la identidad.
 */
const perRender = <T extends (...args: never[]) => unknown>(fn: T): T =>
  (React as { cache?: (f: T) => T }).cache?.(fn) ?? fn

function toVisibility(value: unknown): LibraryVisibility | null {
  return value === 'public' || value === 'friends' || value === 'private' ? value : null
}

function mapOwner(row: OwnerRow): PublicOwner {
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    avatarInitials: row.avatar_initials,
    avatarIcon: row.avatar_icon ?? null,
    bio: row.bio ?? null,
    createdAt: row.created_at ?? null,
    libraryVisibility: toVisibility(row.library_visibility),
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

/** Más reciente primero; lo que no trae fecha, al final y en su orden. */
function byDateDesc<T>(rows: T[], date: (row: T) => string | null | undefined): T[] {
  return rows
    .map((row, i) => ({ row, i, t: Date.parse(date(row) ?? '') }))
    .sort((a, b) => {
      const ta = Number.isFinite(a.t) ? a.t : -Infinity
      const tb = Number.isFinite(b.t) ? b.t : -Infinity
      return tb - ta || a.i - b.i
    })
    .map(({ row }) => row)
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

/** Listas con sus títulos → colección pública (sin vacías, por formato). */
function buildLists(rows: Array<{ id: string; name: string; media_type: string; items: ItemRow[] }>): PublicList[] {
  const lists = rows
    .map((l) => ({
      id: l.id,
      name: l.name,
      mediaType: l.media_type as MediaType,
      items: byDateDesc(l.items, (i) => i.added_at).map(mapItem),
    }))
    .filter((l) => l.items.length > 0)
  return sortByFormat(lists)
}

/**
 * Columnas del dueño que puede leer CUALQUIERA: `harden_rls` (F-02) deja a
 * anon solo estas seis (`grant select (…)`); un `*` sin sesión fallaría con
 * "permission denied". La fecha de alta y la visibilidad se leen aparte, con
 * sesión (`getOwnerDetails`).
 */
const OWNER_COLUMNS = 'id, username, avatar_color, avatar_initials, avatar_icon, bio'
const ITEM_COLUMNS = 'media_id, added_at, media:media_id(id, title, poster, type, year)'
// `lists` y `users` se relacionan también a través de `list_members` y
// `list_items.added_by`: sin la pista, PostgREST no sabría cuál usar.
const NESTED_SELECT = `${OWNER_COLUMNS}, lists!lists_owner_id_fkey(id, name, media_type, created_at, list_items(${ITEM_COLUMNS}))`

async function getOwner(supabase: SupabaseClient, username: string): Promise<OwnerRow | null> {
  const { data } = await supabase.from('users').select(OWNER_COLUMNS).eq('username', username).maybeSingle()
  return (data as OwnerRow | null) ?? null
}

/** Camino de antes (3 consultas en serie): solo si la anidada falla. */
async function loadSequential(supabase: SupabaseClient, username: string): Promise<PublicCollection | null> {
  const ownerRow = await getOwner(supabase, username)
  if (!ownerRow) return null

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
    .select('list_id, media_id, added_at, media:media_id(id, title, poster, type, year)')
    .in('list_id', lists.map((l) => l.id))
    .order('added_at', { ascending: false })

  if (itemsErr) throw new Error(`Failed to fetch public list items: ${itemsErr.message}`)

  const byList = new Map<string, ItemRow[]>()
  for (const row of (itemRows ?? []) as unknown as ItemRow[]) {
    const bucket = byList.get(row.list_id ?? '') ?? []
    bucket.push(row)
    byList.set(row.list_id ?? '', bucket)
  }
  return {
    owner: mapOwner(ownerRow),
    lists: buildLists(lists.map((l) => ({ ...l, items: byList.get(l.id) ?? [] }))),
  }
}

async function loadCollection(username: string): Promise<PublicCollection | null> {
  const supabase = await createClient()
  const nested = await supabase
    .from('users')
    .select(NESTED_SELECT)
    .eq('username', username)
    .eq('lists.is_public', true)
    .maybeSingle()

  if (nested.error) return loadSequential(supabase, username)
  const row = nested.data as NestedOwnerRow | null
  if (!row) return null
  const lists = Array.isArray(row.lists) ? row.lists : []
  return {
    owner: mapOwner(row),
    lists: buildLists(
      byDateDesc(lists, (l) => l.created_at).map((l) => ({
        id: l.id,
        name: l.name,
        media_type: l.media_type,
        items: Array.isArray(l.list_items) ? l.list_items : [],
      })),
    ),
  }
}

/**
 * Colección pública de un usuario. `null` si el usuario no existe.
 * Las listas públicas vacías se omiten: una fila sin títulos parece rota.
 */
export const getPublicCollection = perRender(loadCollection)

/** Una lista pública concreta, solo si es de `username`. */
export async function getPublicList(
  username: string,
  listId: string,
): Promise<{ owner: PublicOwner; list: PublicList } | null> {
  const supabase = await createClient()
  const ownerRow = await getOwner(supabase, username)
  if (!ownerRow) return null

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

/** ¿Existe alguien con ese nombre? (para distinguir "lista privada" de "nombre antiguo"). */
export async function usernameExists(username: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('id').eq('username', username).maybeSingle()
  return Boolean(data)
}

/**
 * Nombre actual de quien se llamaba `oldUsername` (R11 / ROJO-6), o `null`.
 * Lo resuelve `public.username_redirect` (SECURITY DEFINER), así la tabla del
 * historial no se puede listar. Sin la migración de F-12 la función no existe
 * y devuelve `null` (un 404 de los de siempre).
 */
export async function resolveRenamedUsername(oldUsername: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('username_redirect', { p_username: oldUsername })
  if (error || typeof data !== 'string' || !data || data === oldUsername) return null
  return data
}

/** ¿Tiene el usuario al menos una lista pública? (para enseñar "Compartir colección") */
export async function hasPublicLists(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('lists')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('is_public', true)
  return (count ?? 0) > 0
}

// ── Biblioteca en el perfil público (DIS-6, CRE-12) ─────────────────────

/** Códigos de "esto aún no existe" (función o columna sin migrar). */
const NOT_MIGRATED = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

/**
 * Fecha de alta y visibilidad de la biblioteca del dueño, leídas CON SESIÓN
 * (anon no tiene permiso sobre esas columnas). Sin la columna de F-12
 * (42703 / PGRST204), solo la fecha y `libraryVisibility: null`. Cualquier
 * otro fallo: nada (la página sigue sin esos dos datos).
 */
export async function getOwnerDetails(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<Pick<PublicOwner, 'createdAt' | 'libraryVisibility'>> {
  const read = (columns: string) => supabase.from('users').select(columns).eq('id', ownerId).maybeSingle()
  let { data, error } = await read('created_at, library_visibility')
  if (error && NOT_MIGRATED.has(error.code ?? '')) ({ data, error } = await read('created_at'))
  if (error || !data) return { createdAt: null, libraryVisibility: null }
  const row = data as { created_at?: string | null; library_visibility?: string | null }
  return { createdAt: row.created_at ?? null, libraryVisibility: toVisibility(row.library_visibility) }
}


/**
 * ¿Puede quien tiene la sesión de `supabase` leer la biblioteca de `ownerId`?
 * Lo decide la base (`can_read_library`, F-12). Sin la función, rige la
 * política de W1 (cualquiera con sesión puede leer), así que `true`. Cualquier
 * otro error → `false`: ante la duda, no se enseña.
 */
export async function viewerCanReadLibrary(supabase: SupabaseClient, ownerId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_read_library', { p_owner: ownerId })
  if (error) return NOT_MIGRATED.has(error.code ?? '')
  return data === true
}

export interface FavoriteItem extends PublicCollectionItem {
  score: number
}

export interface FormatCount {
  type: MediaType
  count: number
}

export interface LibraryShowcase {
  total: number
  completed: number
  byFormat: FormatCount[]
  favorites: FavoriteItem[]
  watching: PublicCollectionItem[]
}

export const FAVORITES_COUNT = 4
const FAVORITE_CANDIDATES = 40
const WATCHING_COUNT = 12
/** Tope de filas para los contadores (una biblioteca enorme no tumba la página). */
const COUNT_ROWS_CAP = 5000

type ScoredRow = { media_id: string; score: number | null; updated_at?: string | null; media: MediaEmbed }

/**
 * Los 4 favoritos "hasta que exista `favorite`" (W5): los mejor puntuados,
 * uno por formato mientras se pueda (el perfil enseña que KULTURA son 7
 * formatos) y con portada antes que sin ella; si no llegan a 4 formatos, se
 * completa con los siguientes mejor puntuados. Entran ya ordenados por nota.
 */
export function pickFavorites(candidates: FavoriteItem[], count = FAVORITES_COUNT): FavoriteItem[] {
  const ranked = [...candidates].sort((a, b) => b.score - a.score)
  const withPoster = ranked.filter((c) => c.poster)
  // Uno sin portada solo entra si no hay `count` con portada.
  const pools = withPoster.length >= count ? [withPoster] : [withPoster, ranked]
  const picked: FavoriteItem[] = []
  const formats = new Set<string>()
  for (const pool of pools) {
    for (const c of pool) {
      if (picked.length >= count) break
      if (formats.has(c.type) || picked.includes(c)) continue
      picked.push(c)
      formats.add(c.type)
    }
  }
  for (const pool of pools) {
    for (const c of pool) {
      if (picked.length >= count) break
      if (!picked.includes(c)) picked.push(c)
    }
  }
  return picked.sort((a, b) => b.score - a.score || ranked.indexOf(a) - ranked.indexOf(b))
}

/** Contadores por formato a partir de los `media_id` (`movie_550` → `movie`). */
export function countByFormat(rows: Array<{ media_id: string; status?: string | null }>): Omit<LibraryShowcase, 'favorites' | 'watching'> {
  const counts = new Map<MediaType, number>()
  let completed = 0
  for (const row of rows) {
    const type = row.media_id.split('_')[0] as MediaType
    if (!COLLECTION_FORMAT_ORDER.includes(type)) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
    if (row.status === 'completed') completed++
  }
  const byFormat = COLLECTION_FORMAT_ORDER.filter((t) => counts.has(t)).map((type) => ({
    type,
    count: counts.get(type) ?? 0,
  }))
  return { total: byFormat.reduce((n, f) => n + f.count, 0), completed, byFormat }
}

/**
 * Favoritos, contadores y "viendo ahora" de `ownerId`, leídos CON LA SESIÓN de
 * quien mira (la RLS manda). Tres consultas en paralelo (una sola espera).
 * Llamar solo si `viewerCanReadLibrary` dijo que sí.
 */
export async function getLibraryShowcase(supabase: SupabaseClient, ownerId: string): Promise<LibraryShowcase> {
  const [countsRes, favRes, watchRes] = await Promise.all([
    supabase.from('user_media').select('media_id, status').eq('user_id', ownerId).limit(COUNT_ROWS_CAP),
    supabase
      .from('user_media')
      .select('media_id, score, updated_at, media(id, title, poster, type, year)')
      .eq('user_id', ownerId)
      .not('score', 'is', null)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(FAVORITE_CANDIDATES),
    supabase
      .from('user_media')
      .select('media_id, updated_at, media(id, title, poster, type, year)')
      .eq('user_id', ownerId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(WATCHING_COUNT),
  ])

  const counts = countByFormat(countsRes.error ? [] : ((countsRes.data ?? []) as Array<{ media_id: string; status: string }>))
  const candidates = (favRes.error ? [] : ((favRes.data ?? []) as unknown as ScoredRow[]))
    .filter((r) => typeof r.score === 'number' && r.media)
    .map((r) => ({ ...mapItem(r), score: r.score as number }))
  const watching = (watchRes.error ? [] : ((watchRes.data ?? []) as unknown as ItemRow[]))
    .filter((r) => r.media)
    .map(mapItem)

  return { ...counts, favorites: pickFavorites(candidates), watching }
}
