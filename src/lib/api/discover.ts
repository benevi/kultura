// ============================================================
// KULTURA — Discover data fetching logic
// Extracted from app/[locale]/(app)/discover/page.tsx for testability.
// ============================================================

import { getPopularMovies, getPopularTV } from "@/lib/api/tmdb";
import { getPopularAnime, getPopularManga, JikanError } from "@/lib/api/jikan";
import { searchBooks } from "@/lib/api/googlebooks";
import { getPopularGames } from "@/lib/api/rawg";
import { getRecentComics } from "@/lib/api/comicvine";
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

export async function fetchDiscoverData(
  type: string,
  page: number
): Promise<DiscoverResult> {
  let items: MediaItem[] = [];
  let totalPages = 1;
  let fetchErrorKind: FetchErrorKind = null;

  try {
    switch (type) {
      case "movie": {
        const res = await getPopularMovies(page);
        items = res.results.map((m) =>
          normalizeMovie(m as unknown as TmdbMovieDetail)
        );
        totalPages = res.total_pages;
        break;
      }
      case "tv": {
        const res = await getPopularTV(page);
        items = res.results.map((tv) =>
          normalizeTV(tv as unknown as TmdbTVDetail)
        );
        totalPages = res.total_pages;
        break;
      }
      case "anime": {
        const res = await getPopularAnime(page);
        const data = Array.isArray(res.data) ? (res.data as JikanAnime[]) : [];
        items = data.map((a) => normalizeAnime(a));
        totalPages = res.pagination?.last_visible_page ?? 1;
        break;
      }
      case "manga": {
        const res = await getPopularManga(page);
        const data = Array.isArray(res.data) ? (res.data as JikanManga[]) : [];
        items = data.map((m) => normalizeMangaJikan(m));
        totalPages = res.pagination?.last_visible_page ?? 1;
        break;
      }
      case "book": {
        const startIndex = (page - 1) * 20;
        const res = await searchBooks("popular", startIndex);
        items = (res.items ?? []).map((b) => normalizeBookGoogle(b));
        totalPages =
          res.totalItems && res.totalItems > 0
            ? Math.min(Math.ceil(res.totalItems / 20), 50)
            : 1;
        break;
      }
      case "comic": {
        const res = await getRecentComics(page);
        items = res.items;
        // Sin cap: exponemos todas las páginas que reporta ComicVine. res.total es
        // el total bruto de issues; ceil(total/20) da el nº de páginas navegables.
        // Si la API corta el offset en páginas muy altas, devolverán vacío, pero no
        // imponemos tope artificial.
        totalPages = Math.max(Math.ceil(res.total / 20), 1);
        break;
      }
      case "game": {
        const res = await getPopularGames(page);
        items = res.results.map((g) => normalizeGame(g));
        totalPages = Math.ceil(res.count / 20);
        break;
      }
      default: {
        const res = await getPopularMovies(page);
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
