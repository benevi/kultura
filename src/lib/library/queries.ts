// ============================================================
// KULTURA — Library Queries (servidor)
// Helpers server-side para consultar user_media en Supabase.
// Uso exclusivo en Server Components, Route Handlers y Server Actions.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbUserMedia, DbMedia } from '@/types/supabase'
import type { LibraryEntry, LibraryStatus } from '@/types/library'

type UserMediaWithMedia = DbUserMedia & {
  media: Pick<DbMedia, 'title' | 'poster' | 'year'> | null
}

/** Mapea una fila de user_media (con join de media) a LibraryEntry */
function mapEntry(row: UserMediaWithMedia): LibraryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    status: row.status as LibraryStatus,
    score: row.score,
    watchedAt: row.watched_at,
    episodeProgress: row.episode_progress,
    createdAt: row.created_at,
    title: row.media?.title,
    poster: row.media?.poster ?? undefined,
    year: row.media?.year ?? undefined,
  }
}

/**
 * Obtiene todas las entradas de la biblioteca de un usuario,
 * ordenadas por fecha de creación descendente.
 * Incluye datos de visualización de la tabla media (JOIN).
 */
export async function getUserMedia(userId: string): Promise<LibraryEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_media')
    .select('*, media(title, poster, year)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch user media: ${error.message}`)
  }

  return (data as UserMediaWithMedia[]).map(mapEntry)
}

/**
 * Obtiene los últimos N items de la biblioteca de un usuario filtrados por estado.
 * Ordenados por updated_at descendente (más reciente primero).
 */
export async function getRecentLibraryByStatus(
  userId: string,
  status: LibraryStatus,
  limit = 8
): Promise<LibraryEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_media')
    .select('*, media(title, poster, year)')
    .eq('user_id', userId)
    .eq('status', status)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data as UserMediaWithMedia[]).map(mapEntry)
}

/**
 * Obtiene la entrada de biblioteca de un usuario para un título específico.
 * Devuelve null si no existe.
 */
export async function getMediaEntry(
  userId: string,
  mediaId: string
): Promise<LibraryEntry | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', userId)
    .eq('media_id', mediaId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch media entry: ${error.message}`)
  }

  if (!data) return null

  return mapEntry(data as UserMediaWithMedia)
}
