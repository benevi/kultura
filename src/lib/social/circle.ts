// ============================================================
// KULTURA — Popular en tu círculo
// Calcula qué títulos son más populares entre los amigos del usuario.
// Uso exclusivo en Server Components y Route Handlers.
// ============================================================

import { createClient } from '@/lib/supabase/server'

export interface CircleMediaItem {
  mediaId: string
  title: string
  poster: string | null
  type: string
  year: number | null
  /** Nº de amigos que tienen este título en su biblioteca */
  friendCount: number
  /** Lista de usernames de los amigos que lo tienen (máx 3) */
  friendNames: string[]
}

/**
 * Devuelve los títulos más populares entre los amigos del usuario.
 * - Solo cuenta entradas con status 'completed' o 'in_progress'.
 * - Agrega en JS (el círculo social es pequeño, <50 amigos típicamente).
 * - Excluye títulos que el propio usuario ya tiene en su biblioteca.
 */
export async function getPopularInCircle(
  userId: string,
  limit = 5
): Promise<CircleMediaItem[]> {
  const supabase = createClient()

  // 1. Obtener IDs de amigos aceptados
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  if (friendError || !friendships || friendships.length === 0) return []

  const friendIds = friendships.map((f) =>
    f.requester_id === userId ? f.receiver_id : f.requester_id
  )

  // 2. Biblioteca del propio usuario (para excluir)
  const { data: ownMedia } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', userId)

  const ownSet = new Set((ownMedia ?? []).map((r) => r.media_id as string))

  // 3. Biblioteca de todos los amigos (completados o en progreso)
  const { data: friendsMedia, error: mediaError } = await supabase
    .from('user_media')
    .select(
      'media_id, user:user_id(id, username), media:media_id(id, title, poster, type, year)'
    )
    .in('user_id', friendIds)
    .in('status', ['completed', 'in_progress'])

  if (mediaError || !friendsMedia) return []

  // 4. Agregar por media_id
  type Row = {
    media_id: string
    user: { id: string; username: string } | null
    media: { id: string; title: string; poster: string | null; type: string; year: number | null } | null
  }

  const aggregated = new Map<
    string,
    { media: Row['media']; friends: string[] }
  >()

  for (const row of friendsMedia as unknown as Row[]) {
    if (!row.media || !row.user) continue
    if (ownSet.has(row.media_id)) continue // usuario ya lo tiene

    const existing = aggregated.get(row.media_id)
    if (existing) {
      if (!existing.friends.includes(row.user.username)) {
        existing.friends.push(row.user.username)
      }
    } else {
      aggregated.set(row.media_id, {
        media: row.media,
        friends: [row.user.username],
      })
    }
  }

  // 5. Ordenar por nº amigos, tomar top N
  return Array.from(aggregated.entries())
    .sort((a, b) => b[1].friends.length - a[1].friends.length)
    .slice(0, limit)
    .map(([mediaId, { media, friends }]) => ({
      mediaId,
      title: media!.title,
      poster: media!.poster,
      type: media!.type,
      year: media!.year,
      friendCount: friends.length,
      friendNames: friends.slice(0, 3),
    }))
}
