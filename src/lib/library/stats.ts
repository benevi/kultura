// ============================================================
// KULTURA — getUserStats
// Calcula estadísticas de la biblioteca personal del usuario:
// totales por tipo de medio y géneros favoritos.
// ============================================================

import { createClient } from '@/lib/supabase/server'

export interface TypeStats {
  type: string
  total: number
  completed: number
}

export interface UserStats {
  totalItems: number
  totalCompleted: number
  totalInProgress: number
  byType: TypeStats[]
  topGenres: { genre: string; count: number }[]
}

interface MediaRow {
  type: string
  metadata: Record<string, unknown>
}

interface UserMediaRow {
  status: string
  media: MediaRow | null
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_media')
    .select('status, media(type, metadata)')
    .eq('user_id', userId)

  if (error || !data) return { totalItems: 0, totalCompleted: 0, totalInProgress: 0, byType: [], topGenres: [] }

  const rows = data as unknown as UserMediaRow[]

  // byType aggregation
  const typeMap = new Map<string, { total: number; completed: number }>()
  const genreCount = new Map<string, number>()
  let totalCompleted = 0
  let totalInProgress = 0

  for (const row of rows) {
    const media = row.media
    if (!media) continue

    if (row.status === 'completed') totalCompleted++
    if (row.status === 'in_progress') totalInProgress++

    const type = media.type
    const existing = typeMap.get(type) ?? { total: 0, completed: 0 }
    existing.total++
    if (row.status === 'completed') existing.completed++
    typeMap.set(type, existing)

    // genres from metadata
    const genres = (media.metadata?.genres as string[] | undefined) ?? []
    for (const g of genres) {
      genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
    }
  }

  const byType: TypeStats[] = Array.from(typeMap.entries())
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => b.total - a.total)

  const topGenres = Array.from(genreCount.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { totalItems: rows.length, totalCompleted, totalInProgress, byType, topGenres }
}
