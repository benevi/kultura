// ============================================================
// KULTURA — Feed Queries (servidor)
// Obtiene la actividad reciente de los amigos del usuario (PRO-7).
// Uso exclusivo en Server Components: Inicio («Actividad reciente»).
//
// Privacidad: la biblioteca de cada amigo se lee con la sesión de quien mira,
// así que la RLS de `user_media` (can_read_library, F-12) decide: quien la
// tiene en «Solo yo» no aparece. Nada de esto se ve sin sesión.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbUserMedia, DbMedia, DbUser } from '@/types/supabase'

export interface FeedEntry {
  id: string
  userId: string
  mediaId: string
  status: DbUserMedia['status']
  score: number | null
  createdAt: string
  updatedAt: string
  user: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'>
  media: Pick<DbMedia, 'id' | 'title' | 'poster' | 'type'> | null
}

type FeedRow = DbUserMedia & {
  user: Pick<DbUser, 'id' | 'username' | 'avatar_color' | 'avatar_initials'> | null
  media: Pick<DbMedia, 'id' | 'title' | 'poster' | 'type'> | null
}

/** Ids de los amigos aceptados (en las dos direcciones de la amistad). */
export async function getFriendIds(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  if (error) throw new Error(`Failed to fetch friendships: ${error.message}`)
  return Array.from(
    new Set(
      ((friendships ?? []) as Array<{ requester_id: string; receiver_id: string }>).map((f) =>
        f.requester_id === userId ? f.receiver_id : f.requester_id
      )
    )
  )
}

/**
 * Devuelve la actividad reciente de los amigos aceptados del usuario.
 * Estrategia en dos queries:
 *   1. Obtener los IDs de amigos aceptados (o usar `friendIds` si ya se
 *      tienen: Inicio los pide antes para distinguir "sin amigos" de "sin
 *      actividad").
 *   2. Obtener user_media de esos amigos ordenado por updated_at DESC.
 *
 * updated_at se actualiza automáticamente vía trigger `set_updated_at`
 * cada vez que el usuario cambia status, score o progreso — refleja
 * actividad real, no solo cuándo se añadió el item.
 */
export async function getFriendsFeed(
  userId: string,
  limit = 30,
  friendIds?: string[]
): Promise<FeedEntry[]> {
  const ids = friendIds ?? (await getFriendIds(userId))
  if (ids.length === 0) return []

  const supabase = await createClient()
  // 2. Actividad reciente de esos amigos (ordenada por última actualización)
  const { data, error } = await supabase
    .from('user_media')
    .select(
      'id, user_id, media_id, status, score, created_at, updated_at, user:user_id(id, username, avatar_color, avatar_initials), media:media_id(id, title, poster, type)'
    )
    .in('user_id', ids)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch feed: ${error.message}`)

  return (data as unknown as FeedRow[])
    .filter((row) => row.user !== null)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      status: row.status,
      score: row.score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: row.user!,
      media: row.media,
    }))
}
