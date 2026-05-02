// ============================================================
// KULTURA — Feed Queries (servidor)
// Obtiene la actividad reciente de los amigos del usuario.
// Uso exclusivo en Server Components.
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

/**
 * Devuelve la actividad reciente de los amigos aceptados del usuario.
 * Estrategia en dos queries:
 *   1. Obtener los IDs de amigos aceptados.
 *   2. Obtener user_media de esos amigos ordenado por updated_at DESC.
 *
 * updated_at se actualiza automáticamente vía trigger `set_updated_at`
 * cada vez que el usuario cambia status, score o progreso — refleja
 * actividad real, no solo cuándo se añadió el item.
 */
export async function getFriendsFeed(
  userId: string,
  limit = 30
): Promise<FeedEntry[]> {
  const supabase = createClient()

  // 1. IDs de amigos aceptados (ambas direcciones)
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  if (friendError) throw new Error(`Failed to fetch friendships: ${friendError.message}`)
  if (!friendships || friendships.length === 0) return []

  const friendIds = friendships.map((f) =>
    f.requester_id === userId ? f.receiver_id : f.requester_id
  )

  // 2. Actividad reciente de esos amigos (ordenada por última actualización)
  const { data, error } = await supabase
    .from('user_media')
    .select(
      'id, user_id, media_id, status, score, created_at, updated_at, user:user_id(id, username, avatar_color, avatar_initials), media:media_id(id, title, poster, type)'
    )
    .in('user_id', friendIds)
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
