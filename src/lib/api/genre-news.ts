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

/**
 * Nombre visible de cada género TMDB por idioma. El perfil guarda los géneros
 * tal como los sirvió cada proveedor ("Action" de AniList o RAWG, "Acción" de
 * TMDB en español), y el título de la fila los pintaba crudos: "Novedades en
 * Action" en la interfaz en español.
 */
const GENRE_LABELS: Record<'es' | 'en', Record<number, string>> = {
  es: {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
    99: 'Documental', 18: 'Drama', 10751: 'Familia', 14: 'Fantasía', 36: 'Historia',
    27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance',
    878: 'Ciencia ficción', 53: 'Suspense', 10752: 'Bélica', 37: 'Western',
  },
  en: {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
    878: 'Science Fiction', 53: 'Thriller', 10752: 'War', 37: 'Western',
  },
}

/** Etiquetas en el idioma de la app, sin repetir el mismo género dos veces. */
export function localizeGenreNames(names: string[], locale?: string | null): string[] {
  const labels = GENRE_LABELS[locale === 'en' ? 'en' : 'es']
  const out: string[] = []
  for (const name of names) {
    const id = TMDB_GENRE_MAP[name]
    const label = id !== undefined ? labels[id] ?? name : name
    if (!out.includes(label)) out.push(label)
  }
  return out
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
  limit = 5,
  locale?: string | null
): Promise<GenreNewsResult> {
  const rawNames = topGenres.slice(0, 3)
  const genreIds = genreNamesToIds(rawNames)
  const genreNames = localizeGenreNames(rawNames, locale)

  if (genreIds.length === 0) {
    return { movies: [], tv: [], genres: genreNames }
  }

  // E-TMDB-LOCALE: el locale activo llega desde el route handler → los títulos
  // y sinopsis de "novedades" respetan el idioma de la app.
  const [moviesResult, tvResult] = await Promise.allSettled([
    discoverByGenre('movie', genreIds, limit, locale),
    discoverByGenre('tv', genreIds, limit, locale),
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
