import type { Metadata } from "next";
import { getPopularMovies, getPopularTV } from "@/lib/api/tmdb";
import { getPopularAnime, getPopularManga } from "@/lib/api/jikan";
import { searchBooks } from "@/lib/api/googlebooks";
import { getPopularGames } from "@/lib/api/rawg";
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
import { DiscoverClient } from "./DiscoverClient";

interface SearchParams {
  type?: string;
  page?: string;
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Descubrir" : "Discover",
  };
}

export default async function DiscoverPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const type = resolvedSearchParams.type ?? "movie";
  const page = Math.max(1, parseInt(resolvedSearchParams.page ?? "1", 10) || 1);

  let items: MediaItem[] = [];
  let totalPages = 1;

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
        items = (res.data as JikanAnime[]).map((a) => normalizeAnime(a));
        totalPages = res.pagination.last_visible_page;
        break;
      }
      case "manga": {
        const res = await getPopularManga(page);
        items = (res.data as JikanManga[]).map((m) => normalizeMangaJikan(m));
        totalPages = res.pagination.last_visible_page;
        break;
      }
      case "book": {
        const startIndex = (page - 1) * 20;
        const res = await searchBooks("popular", startIndex);
        items = (res.items ?? []).map((b) => normalizeBookGoogle(b));
        const rawTotal = Math.ceil(res.totalItems / 20);
        totalPages = Math.min(rawTotal, 50);
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
  } catch {
    items = [];
    totalPages = 1;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <DiscoverClient
        items={items}
        currentType={type}
        currentPage={page}
        totalPages={totalPages}
      />
    </main>
  );
}
