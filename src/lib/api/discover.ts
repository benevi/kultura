// ============================================================
// KULTURA — Discover data fetching logic
// Extracted from app/[locale]/(app)/discover/page.tsx for testability.
// ============================================================

import { discoverMovies, discoverTV } from "@/lib/api/tmdb";
import { buildTmdbDiscoverParams, type TmdbFilters } from "@/lib/api/tmdb-maps";
import {
  getPopularAnime,
  getPopularManga,
  discoverAnime,
  discoverManga,
  JikanError,
} from "@/lib/api/jikan";
import {
  buildJikanDiscoverParams,
  hasJikanFilters,
  filterByMinVolumes,
  type JikanFilters,
} from "@/lib/api/jikan-maps";
import { searchBooks } from "@/lib/api/googlebooks";
import {
  buildBooksQuery,
  hasBookFilters,
  BOOKS_BASE_QUERY,
  type BooksFilters,
} from "@/lib/api/books-maps";
import { getPopularGames, discoverGames } from "@/lib/api/rawg";
import {
  buildRawgDiscoverParams,
  applyGamePostFilters,
  type RawgFilters,
} from "@/lib/api/rawg-maps";
import { getRecentComics } from "@/lib/api/comicvine";
import {
  hasComicFilters,
  type ComicFilters,
} from "@/lib/api/comicvine-maps";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeMangaJikan,
  normalizeBookGoogle,
  normalizeGame,
} from "@/lib/api/normalizer";
import type { MediaItem } from "@/types/media";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
import type { JikanAnime, JikanManga } from "@/lib/api/jikan";

export type FetchErrorKind = "rate-limit" | "generic" | null;

export interface DiscoverResult {
  items: MediaItem[];
  totalPages: number;
  fetchErrorKind: FetchErrorKind;
}

/**
 * Filtros canónicos aplicables a la capa de fetch. Unión de los subconjuntos que
 * cada familia consume nativamente: TMDB (F3a), Jikan + RAWG (F3b). Cada builder
 * toma solo los campos que entiende; el resto los ignora.
 */
export type DiscoverFilters = TmdbFilters &
  JikanFilters &
  RawgFilters &
  BooksFilters &
  ComicFilters;

export async function fetchDiscoverData(
  type: string,
  page: number,
  filters: DiscoverFilters = {}
): Promise<DiscoverResult> {
  let items: MediaItem[] = [];
  let totalPages = 1;
  let fetchErrorKind: FetchErrorKind = null;

  try {
    switch (type) {
      case "movie": {
        const res = await discoverMovies(
          page,
          buildTmdbDiscoverParams("movie", filters)
        );
        items = res.results.map((m) =>
          normalizeMovie(m as unknown as TmdbMovieDetail)
        );
        totalPages = res.total_pages;
        break;
      }
      case "tv": {
        const res = await discoverTV(
          page,
          buildTmdbDiscoverParams("tv", filters)
        );
        items = res.results.map((tv) =>
          normalizeTV(tv as unknown as TmdbTVDetail)
        );
        totalPages = res.total_pages;
        break;
      }
      case "anime": {
        // Con filtros → /anime (búsqueda, acepta filtros); sin filtros → /top/anime.
        const res = hasJikanFilters(filters)
          ? await discoverAnime(page, buildJikanDiscoverParams("anime", filters))
          : await getPopularAnime(page);
        const data = Array.isArray(res.data) ? (res.data as JikanAnime[]) : [];
        items = data.map((a) => normalizeAnime(a));
        totalPages = res.pagination?.last_visible_page ?? 1;
        break;
      }
      case "manga": {
        const res = hasJikanFilters(filters)
          ? await discoverManga(page, buildJikanDiscoverParams("manga", filters))
          : await getPopularManga(page);
        const data = Array.isArray(res.data) ? (res.data as JikanManga[]) : [];
        items = data.map((m) => normalizeMangaJikan(m));
        // POST-filtro de volúmenes (solo manga): umbral mínimo sobre metadata.volumes.
        // Vacío/desconocido → no filtra. anime no pasa por aquí (oculto).
        items = filterByMinVolumes(items, filters.volumenes);
        totalPages = res.pagination?.last_visible_page ?? 1;
        break;
      }
      case "book": {
        const startIndex = (page - 1) * 20;
        // Con filtros (género/formato/idioma/sort) → query construida; sin
        // filtros, paridad con hoy (query base "popular", sin orderBy/filter).
        // year sigue sin aplicarse (oculto para book).
        let res;
        if (hasBookFilters(filters)) {
          const { q, params } = buildBooksQuery(filters);
          res = await searchBooks(q, startIndex, params);
        } else {
          res = await searchBooks(BOOKS_BASE_QUERY, startIndex);
        }
        items = (res.items ?? []).map((b) => normalizeBookGoogle(b));
        totalPages =
          res.totalItems && res.totalItems > 0
            ? Math.min(Math.ceil(res.totalItems / 20), 50)
            : 1;
        break;
      }
      case "comic": {
        // Con filtros (sort/year/editorial) → getRecentComics filtrado; sin
        // filtros, paridad con hoy. genre sigue oculto para comic.
        const res = hasComicFilters(filters)
          ? await getRecentComics(page, filters)
          : await getRecentComics(page);
        items = res.items;
        // Sin cap: exponemos todas las páginas que reporta ComicVine. res.total es
        // el total bruto de issues; ceil(total/20) da el nº de páginas navegables.
        // Si la API corta el offset en páginas muy altas, devolverán vacío, pero no
        // imponemos tope artificial.
        totalPages = Math.max(Math.ceil(res.total / 20), 1);
        break;
      }
      case "game": {
        // Con filtros (género/plataforma/año/sort) → /games filtrado; sin filtros
        // se mantiene getPopularGames (ordering=-rating) para paridad F2.
        const hasRawgFilters = Boolean(
          filters.genre?.length ||
            filters.platform?.length ||
            filters.year ||
            filters.sort
        );
        const res = hasRawgFilters
          ? await discoverGames(page, buildRawgDiscoverParams(filters))
          : await getPopularGames(page);
        items = res.results.map((g) => normalizeGame(g));
        // POST-filtros game (R4c-1): valoracion(metacritic)/estado/modojuego/
        // duracionmedia. NO gatean el fetch (no están en hasRawgFilters); se
        // aplican tras normalizar, mismo patrón que volumenes×manga. Caveat
        // paginación E79 conocido (overfetch sin recomputar totalPages).
        items = applyGamePostFilters(items, filters);
        totalPages = Math.ceil(res.count / 20);
        break;
      }
      default: {
        const res = await discoverMovies(
          page,
          buildTmdbDiscoverParams("movie", filters)
        );
        items = res.results.map((m) =>
          normalizeMovie(m as unknown as TmdbMovieDetail)
        );
        totalPages = res.total_pages;
        break;
      }
    }
  } catch (e) {
    console.error(`[discover] API error (type=${type} page=${page}):`, e);
    if (e instanceof JikanError && e.status === 429) {
      fetchErrorKind = "rate-limit";
    } else {
      fetchErrorKind = "generic";
    }
    items = [];
    totalPages = 1;
  }

  return { items, totalPages, fetchErrorKind };
}
