// ============================================================
// KULTURA — Route Handler: /api/genre-news
// GET: novedades recientes en los géneros favoritos del usuario.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserStats } from '@/lib/library/stats'
import { getLocale } from 'next-intl/server'
import { getGenreNews } from '@/lib/api/genre-news'
import { checkRateLimit } from '@/lib/rate-limit'

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

  // E-TMDB-LOCALE: novedades en el idioma activo de la app.
  const locale = await getLocale()
  const result = await getGenreNews(topGenres, 5, locale)

  // E-MATCH-SIN-BADGE: el match se calculaba aquí solo para el badge de la
  // fila de novedades, que ya no se pinta.
  return NextResponse.json(result)
}
