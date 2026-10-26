// ============================================================
// KULTURA — Library Queries (servidor)
// Helpers server-side para consultar user_media en Supabase.
// Uso exclusivo en Server Components, Route Handlers y Server Actions.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbUserMedia, DbMedia } from '@/types/supabase'
import type { LibraryStatus } from '@/types/library'
import { entryRating10 } from '@/lib/library/rating'
import { progressFromRow, type LibraryEntryWithProgress } from '@/lib/library/progress'

type UserMediaWithMedia = DbUserMedia & {
  media: Pick<DbMedia, 'title' | 'poster' | 'year'> | null
}

/**
 * Mapea una fila de user_media (con join de media) a LibraryEntry. Las
 * columnas de F-24 (rating10, favorite) llegan con `*` si la migración está
 * aplicada; si no, rating10 = score × 2 y favorite = false. Igual el
 * progreso de F-27 (`progress`): columnas `progress_*` o, sin ellas, el jsonb.
 */
function mapEntry(row: UserMediaWithMedia): LibraryEntryWithProgress {
  const rating10 = row.rating10 === null || row.rating10 === undefined ? undefined : Number(row.rating10)
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    status: row.status as LibraryStatus,
    score: row.score,
    rating10: entryRating10({ rating10, score: row.score }),
    favorite: row.favorite ?? false,
    watchedAt: row.watched_at,
    episodeProgress: row.episode_progress,
    // F-27: columnas progress_* si la migración está; si no, el jsonb.
    progress: progressFromRow(row as unknown as Record<string, unknown>),
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
export async function getUserMedia(userId: string): Promise<LibraryEntryWithProgress[]> {
  const supabase = await createClient()

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
): Promise<LibraryEntryWithProgress[]> {
  const supabase = await createClient()

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
): Promise<LibraryEntryWithProgress | null> {
  const supabase = await createClient()

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
