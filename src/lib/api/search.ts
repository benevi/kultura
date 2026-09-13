// ============================================================
// KULTURA — Búsqueda por familia
// Traduce una query de texto a la búsqueda nativa de cada proveedor y devuelve
// resultados ya normalizados a MediaItem.
//
// E-DISCOVER-SEARCH-MERGE: `searchAll` (que agregaba las 6 familias en una sola
// respuesta con forma `{movies, tv, anime, …}`) se ELIMINÓ al fusionar /search
// dentro de /discover: su único consumidor era la página /search, que ahora es
// un redirect. El agregado de búsqueda vive en `fetchAggregateSearch`
// (aggregate.ts), que reusa `searchByTypePaged` y devuelve la misma forma
// paginada que el resto de Descubrir.
// ============================================================

import type { MediaItem, MediaType } from "@/types/media";
import { searchMovies, searchTV } from "./tmdb";
import { searchAnime } from "./jikan";
import type { JikanAnime } from "./jikan";
import { searchManga } from "./mangadex";
import { searchGoogleBooks, googleBooksTotalPages } from "./googlebooks";
import { searchGames } from "./rawg";
import { searchComics } from "./comicvine";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeMangaDex,
  normalizeBookGoogle,
  normalizeGame,
  normalizeComic,
} from "./normalizer";
import type { TmdbMovieDetail, TmdbTVDetail } from "./tmdb";
import type { JikanAnimeDetail } from "./jikan";

/** Ítems por página (offset-based) de MangaDex — = page-size de Descubrir. */
const MANGADEX_PAGE_SIZE = 20;

/**
 * Busca solo en el tipo de contenido indicado (SIN paginar: primera página).
 * La usan las recomendaciones IA para resolver la referencia de cada título.
 *
 * `locale`: idioma activo de la app. Se propaga a los proveedores que lo
 * soportan (TMDB, Google Books); Jikan, ComicVine y RAWG lo ignoran (limitación
 * documentada en `lib/api/locale.ts`).
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
      return searchManga(query, 0, locale).then((r) =>
        r.data.map((raw) => normalizeMangaDex(raw, locale))
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

// ── Búsqueda PAGINADA por familia (E-DISCOVER-SEARCH-MERGE) ──────────────────

/**
 * Una página de resultados de búsqueda de UNA familia, con la misma forma que
 * consume la paginación de Descubrir (`items` / `totalPages` / `hasMore`).
 *
 * `totalPages` es `null` cuando el proveedor no da un total fiable para la
 * búsqueda; la UI pinta entonces ventana abierta (patrón E79-s2).
 */
export interface SearchPage {
  items: MediaItem[];
  totalPages: number | null;
  hasMore: boolean;
}

/** Ítems por página de búsqueda (= page-size de Descubrir). */
const SEARCH_PAGE_SIZE = 20;

/**
 * Busca en una familia con paginación real donde el proveedor la soporta:
 *   - movie/tv (TMDB `/search/*`): `page` + `total_pages`.
 *   - anime/manga (Jikan `/anime`,`/manga`): `page` + `last_visible_page`.
 *   - book (Google Books): `startIndex` + `totalItems`.
 *   - game (RAWG `/games?search=`): `page` + `count`.
 *   - comic (ComicVine `/issues/`): `offset` + `number_of_total_results`.
 * Todos paginan, así que no hay familia degradada a "solo página 1"; el tope
 * común de páginas lo aplica el llamador (`fetchDiscoverData`).
 */
export async function searchByTypePaged(
  query: string,
  type: MediaType,
  page = 1,
  locale?: string | null
): Promise<SearchPage> {
  switch (type) {
    case "movie": {
      const r = await searchMovies(query, page, locale);
      const totalPages = Math.max(r.total_pages ?? 1, 1);
      return {
        items: r.results.map((raw) => normalizeMovie(raw as TmdbMovieDetail)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "tv": {
      const r = await searchTV(query, page, locale);
      const totalPages = Math.max(r.total_pages ?? 1, 1);
      return {
        items: r.results.map((raw) => normalizeTV(raw as TmdbTVDetail)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "anime": {
      const r = await searchAnime(query, page);
      const totalPages = Math.max(r.pagination?.last_visible_page ?? 1, 1);
      return {
        items: (r.data as JikanAnime[]).map((raw) =>
          normalizeAnime(raw as JikanAnimeDetail)
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "manga": {
      // MangaDex pagina por offset/limit, no por page — se traduce aquí.
      const offset = (page - 1) * MANGADEX_PAGE_SIZE;
      const r = await searchManga(query, offset, locale);
      const totalPages = Math.max(
        Math.ceil((r.total ?? 0) / MANGADEX_PAGE_SIZE),
        1
      );
      return {
        items: r.data.map((raw) => normalizeMangaDex(raw, locale)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "book": {
      const r = await searchGoogleBooks(query, page, {}, locale);
      const totalPages = googleBooksTotalPages(r.totalItems);
      return {
        items: (r.items ?? []).map((raw) => normalizeBookGoogle(raw)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "game": {
      const r = await searchGames(query, page);
      const totalPages = Math.max(
        Math.ceil((r.count ?? 0) / SEARCH_PAGE_SIZE),
        1
      );
      return {
        items: r.results.map((raw) => normalizeGame(raw)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "comic": {
      const r = await searchComics(query, page);
      const totalPages = Math.max(
        Math.ceil((r.number_of_total_results ?? 0) / SEARCH_PAGE_SIZE),
        1
      );
      return {
        items: (r.results ?? []).map((raw) => normalizeComic(raw)),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    default:
      return { items: [], totalPages: 1, hasMore: false };
  }
}
