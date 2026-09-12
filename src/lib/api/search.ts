// ============================================================
// KULTURA — Search aggregator
// Busca en todas las APIs externas en paralelo y devuelve
// resultados normalizados al tipo unificado MediaItem.
// ============================================================

import type { MediaItem, MediaType } from "@/types/media";
import { searchMovies, searchTV } from "./tmdb";
import { searchAnime, searchManga } from "./jikan";
import type { JikanAnime, JikanManga } from "./jikan";
import { searchGoogleBooks } from "./googlebooks";
import { searchGames } from "./rawg";
import { searchComics } from "./comicvine";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeMangaJikan,
  normalizeBookGoogle,
  normalizeGame,
  normalizeComic,
} from "./normalizer";
import type { TmdbMovieDetail, TmdbTVDetail } from "./tmdb";
import type { JikanAnimeDetail, JikanMangaDetail } from "./jikan";

export interface SearchResults {
  movies: MediaItem[];
  tv: MediaItem[];
  anime: MediaItem[];
  manga: MediaItem[];
  books: MediaItem[];
  games: MediaItem[];
}

/**
 * Busca en todas las APIs en paralelo con Promise.allSettled.
 * Si una falla → array vacío para ese tipo, el resto permanece intacto.
 *
 * `locale` (E-TMDB-LOCALE / E-BOOKS-GOOGLE): idioma activo de la app. Se
 * propaga a los proveedores que lo soportan (TMDB, Google Books); Jikan,
 * ComicVine y RAWG lo ignoran (limitación documentada en `lib/api/locale.ts`).
 */
export async function searchAll(
  query: string,
  locale?: string | null
): Promise<SearchResults> {
  const [movies, tv, anime, manga, books, games] = await Promise.allSettled([
    searchMovies(query, 1, locale).then((r) =>
      r.results.map((raw) => normalizeMovie(raw as TmdbMovieDetail))
    ),
    searchTV(query, 1, locale).then((r) =>
      r.results.map((raw) => normalizeTV(raw as TmdbTVDetail))
    ),
    searchAnime(query).then((r) =>
      (r.data as JikanAnime[]).map((raw) =>
        normalizeAnime(raw as JikanAnimeDetail)
      )
    ),
    searchManga(query).then((r) =>
      (r.data as JikanManga[]).map((raw) =>
        normalizeMangaJikan(raw as JikanMangaDetail)
      )
    ),
    searchGoogleBooks(query, 1, {}, locale).then((r) =>
      (r.items ?? []).map((raw) => normalizeBookGoogle(raw))
    ),
    searchGames(query).then((r) =>
      r.results.map((raw) => normalizeGame(raw))
    ),
  ]);

  return {
    movies: movies.status === "fulfilled" ? movies.value : [],
    tv: tv.status === "fulfilled" ? tv.value : [],
    anime: anime.status === "fulfilled" ? anime.value : [],
    manga: manga.status === "fulfilled" ? manga.value : [],
    books: books.status === "fulfilled" ? books.value : [],
    games: games.status === "fulfilled" ? games.value : [],
  };
}

/**
 * Busca solo en el tipo de contenido indicado.
 * `locale`: ver `searchAll`.
 */
export async function searchByType(
  query: string,
  type: MediaType,
  locale?: string | null
): Promise<MediaItem[]> {
  switch (type) {
    case "movie":
      return searchMovies(query, 1, locale).then((r) =>
        r.results.map((raw) => normalizeMovie(raw as TmdbMovieDetail))
      );
    case "tv":
      return searchTV(query, 1, locale).then((r) =>
        r.results.map((raw) => normalizeTV(raw as TmdbTVDetail))
      );
    case "anime":
      return searchAnime(query).then((r) =>
        (r.data as JikanAnime[]).map((raw) =>
          normalizeAnime(raw as JikanAnimeDetail)
        )
      );
    case "manga":
      return searchManga(query).then((r) =>
        (r.data as JikanManga[]).map((raw) =>
          normalizeMangaJikan(raw as JikanMangaDetail)
        )
      );
    case "book":
      return searchGoogleBooks(query, 1, {}, locale).then((r) =>
        (r.items ?? []).map((raw) => normalizeBookGoogle(raw))
      );
    case "game":
      return searchGames(query).then((r) =>
        r.results.map((raw) => normalizeGame(raw))
      );
    case "comic":
      // ComicVine es server-only (COMICVINE_KEY). searchByType solo se llama
      // desde código server-side (recomendaciones IA, route handlers).
      return searchComics(query).then((r) =>
        (r.results ?? []).map((raw) => normalizeComic(raw))
      );
    default:
      return [];
  }
}
