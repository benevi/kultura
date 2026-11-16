// ============================================================
// KULTURA — Route Handler: /api/genre-news
// GET: novedades recientes en los géneros favoritos del usuario.
//
// Respuesta: `{ data: { movies, tv, genres } }` o `{ error: { code } }`
// (saneamiento 7 y 9).
// ============================================================

import { getLocale } from 'next-intl/server'
import { ok, rateLimit, requireUser } from '@/lib/api/route'
import { getUserStats } from '@/lib/library/stats'
import { getGenreNews } from '@/lib/api/genre-news'

const GENRE_NEWS_LIMIT = { windowMs: 60_000, max: 20 }

/** GET /api/genre-news */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'genre-news', limit: GENRE_NEWS_LIMIT, userId: auth.user.id })
  if (limited) return limited

  const stats = await getUserStats(auth.user.id)
  const topGenres = stats.topGenres.map((g) => g.genre)

  // E-TMDB-LOCALE: novedades en el idioma activo de la app.
  const locale = await getLocale()
  // E-MATCH-SIN-BADGE: el match se calculaba aquí solo para el badge de la
  // fila de novedades, que ya no se pinta.
  return ok(await getGenreNews(topGenres, 5, locale))
}
