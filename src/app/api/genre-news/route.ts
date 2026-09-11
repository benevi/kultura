// ============================================================
// KULTURA — Route Handler: /api/genre-news
// GET: novedades recientes en los géneros favoritos del usuario.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserStats } from '@/lib/library/stats'
import { getGenreNews } from '@/lib/api/genre-news'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeMatchScores } from '@/lib/recommendations/match-score'

const GENRE_NEWS_LIMIT = { windowMs: 60_000, max: 20 }

/** GET /api/genre-news */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:genre-news`, GENRE_NEWS_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const stats = await getUserStats(user.id)
  const topGenres = stats.topGenres.map((g) => g.genre)

  const result = await getGenreNews(topGenres)

  // F3b: badge de match real (F3a) para la fila "trending" de Home — la más
  // análoga a las filas del mockup F0. Vacío si no hay señal suficiente
  // (gate de computeMatchScores), nunca un número decorativo.
  const matchScores = await computeMatchScores(user.id, [...result.movies, ...result.tv])

  return NextResponse.json({ ...result, matchScores: Object.fromEntries(matchScores) })
}
