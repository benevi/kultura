// ============================================================
// KULTURA — Novedades en tus géneros favoritos
// Consulta TMDB /discover con los géneros top del usuario.
// Solo movies y TV (TMDB). Anime/manga/libros fuera de scope aquí.
// ============================================================

import { discoverByGenre, TMDB_GENRE_MAP } from '@/lib/api/tmdb'
import { normalizeMovie, normalizeTV } from '@/lib/api/normalizer'
import type { TmdbMovieDetail, TmdbTVDetail, TmdbSearchResponse, TmdbTVSearchResponse } from '@/lib/api/tmdb'
import type { MediaItem } from '@/types/media'

/**
 * Convierte nombres de géneros a IDs TMDB.
 * Ignora géneros que no están en el mapa.
 */
function genreNamesToIds(names: string[]): number[] {
  const ids: number[] = []
  for (const name of names) {
    const id = TMDB_GENRE_MAP[name]
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export interface GenreNewsResult {
  movies: MediaItem[]
  tv: MediaItem[]
  genres: string[]
}

/**
 * Devuelve novedades de películas y series en los géneros favoritos del usuario.
 * - `topGenres`: lista de nombres de géneros (viene de getUserStats().topGenres)
 * - Usa máximo los 3 primeros géneros para no sobre-filtrar.
 * - Devuelve vacío si no hay géneros mapeables.
 */
export async function getGenreNews(
  topGenres: string[],
  limit = 5
): Promise<GenreNewsResult> {
  const genreNames = topGenres.slice(0, 3)
  const genreIds = genreNamesToIds(genreNames)

  if (genreIds.length === 0) {
    return { movies: [], tv: [], genres: genreNames }
  }

  const [moviesResult, tvResult] = await Promise.allSettled([
    discoverByGenre('movie', genreIds, limit),
    discoverByGenre('tv', genreIds, limit),
  ])

  const movies: MediaItem[] =
    moviesResult.status === 'fulfilled'
      ? (moviesResult.value as TmdbSearchResponse).results.map((r) =>
          normalizeMovie(r as TmdbMovieDetail)
        )
      : []

  const tv: MediaItem[] =
    tvResult.status === 'fulfilled'
      ? (tvResult.value as TmdbTVSearchResponse).results.map((r) =>
          normalizeTV(r as TmdbTVDetail)
        )
      : []

  return { movies, tv, genres: genreNames }
}
