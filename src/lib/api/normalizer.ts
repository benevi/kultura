// ============================================================
// KULTURA — API Response Normalizer
// Convierte respuestas crudas de todas las APIs externas al
// tipo unificado MediaItem antes de llegar a cualquier componente.
// ============================================================

import type { MediaItem, StreamingProvider } from "@/types/media";
import {
  tmdbPoster,
  tmdbBackdrop,
  type TmdbMovieDetail,
  type TmdbTVDetail,
  type TmdbProvidersResponse,
} from "./tmdb";
import type { JikanAnimeDetail, JikanMangaDetail } from "./jikan";
import type { MangaDexManga } from "./mangadex";
import { extractMangaCover } from "./mangadex";
import type { GoogleBooksVolume } from "./googlebooks";
import type { OpenLibraryDoc } from "./openlibrary";
import { openLibraryCover } from "./openlibrary";
import type { RawgGame } from "./rawg";
import type { ComicVineIssue } from "@/types/media";

// ── Provider helper ───────────────────────────────────────────────────────────

function extractProviders(
  providersResp: TmdbProvidersResponse | undefined
): StreamingProvider[] | undefined {
  const es = providersResp?.results?.["ES"];
  if (!es) return undefined;
  const all: StreamingProvider[] = [];
  (["flatrate", "rent", "buy"] as const).forEach((type) => {
    es[type]?.forEach((p) =>
      all.push({
        name: p.provider_name,
        logoPath: `https://image.tmdb.org/t/p/original${p.logo_path}`,
        type,
      })
    );
  });
  return all.length > 0 ? all : undefined;
}

// ── Year extraction ───────────────────────────────────────────────────────────

function extractYear(dateStr: string | null | undefined): number | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : undefined;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

export function normalizeMovie(
  raw: TmdbMovieDetail,
  providers?: TmdbProvidersResponse
): MediaItem {
  const externalId = String(raw.id);

  // Extract trailer: first YouTube trailer or teaser
  const videos = raw.videos?.results ?? [];
  const trailer = videos.find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );

  // Director from credits
  const director = raw.credits?.crew.find((c) => c.job === "Director")?.name;
  const cast = raw.credits?.cast.slice(0, 5).map((c) => c.name) ?? [];

  return {
    id: `movie_${externalId}`,
    externalId,
    type: "movie",
    title: raw.title,
    originalTitle: raw.original_title !== raw.title ? raw.original_title : undefined,
    poster: tmdbPoster(raw.poster_path),
    backdrop: tmdbBackdrop(raw.backdrop_path),
    year: extractYear(raw.release_date),
    synopsis: raw.overview || undefined,
    genres: raw.genres?.map((g) => g.name),
    rating: raw.vote_average > 0 ? raw.vote_average : undefined,
    ratingSource: "TMDB",
    trailerKey: trailer?.key,
    streamingProviders:
      extractProviders(providers ?? raw["watch/providers"]),
    metadata: {
      runtime: raw.runtime ?? undefined,
      director,
      cast,
    },
  };
}

export function normalizeTV(
  raw: TmdbTVDetail,
  providers?: TmdbProvidersResponse
): MediaItem {
  const externalId = String(raw.id);

  const videos = raw.videos?.results ?? [];
  const trailer = videos.find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );

  const cast = raw.credits?.cast.slice(0, 5).map((c) => c.name) ?? [];
  const networks = raw.networks?.map((n) => n.name) ?? [];

  return {
    id: `tv_${externalId}`,
    externalId,
    type: "tv",
    title: raw.name,
    originalTitle: raw.original_name !== raw.name ? raw.original_name : undefined,
    poster: tmdbPoster(raw.poster_path),
    backdrop: tmdbBackdrop(raw.backdrop_path),
    year: extractYear(raw.first_air_date),
    synopsis: raw.overview || undefined,
    genres: raw.genres?.map((g) => g.name),
    rating: raw.vote_average > 0 ? raw.vote_average : undefined,
    ratingSource: "TMDB",
    trailerKey: trailer?.key,
    streamingProviders:
      extractProviders(providers ?? raw["watch/providers"]),
    metadata: {
      episodes: raw.number_of_episodes,
      seasons: raw.number_of_seasons,
      status: raw.status,
      networks,
      cast,
    },
  };
}

export function normalizeAnime(raw: JikanAnimeDetail): MediaItem {
  const externalId = String(raw.mal_id);

  return {
    id: `anime_${externalId}`,
    externalId,
    type: "anime",
    title: raw.title_english ?? raw.title,
    originalTitle:
      raw.title_english && raw.title_english !== raw.title
        ? raw.title
        : undefined,
    poster: raw.images?.jpg?.large_image_url || undefined,
    year: raw.year ?? undefined,
    synopsis: raw.synopsis ?? undefined,
    genres: raw.genres?.map((g) => g.name),
    rating: raw.score ?? undefined,
    ratingSource: "MAL",
    trailerKey: raw.trailer?.youtube_id ?? undefined,
    metadata: {
      episodes: raw.episodes ?? undefined,
      status: raw.status,
      studio: raw.studios?.[0]?.name ?? undefined,
      source: raw.source,
    },
  };
}

export function normalizeMangaJikan(raw: JikanMangaDetail): MediaItem {
  const externalId = String(raw.mal_id);

  return {
    id: `manga_${externalId}`,
    externalId,
    type: "manga",
    title: raw.title,
    poster: raw.images?.jpg?.large_image_url || undefined,
    year: raw.published?.prop?.from?.year ?? undefined,
    synopsis: raw.synopsis ?? undefined,
    genres: raw.genres?.map((g) => g.name),
    rating: raw.score ?? undefined,
    ratingSource: "MAL",
    metadata: {
      chapters: raw.chapters ?? undefined,
      volumes: raw.volumes ?? undefined,
      status: raw.status,
      authors: raw.authors?.map((a) => a.name) ?? [],
    },
  };
}

export function normalizeMangaDex(raw: MangaDexManga): MediaItem {
  const externalId = raw.id;
  const attrs = raw.attributes;

  // Title: prefer English, then romanized, then first available
  const title =
    attrs.title["en"] ??
    attrs.title["ja-ro"] ??
    Object.values(attrs.title)[0] ??
    "Unknown";

  // Synopsis: prefer English
  const synopsis =
    attrs.description["en"] ??
    Object.values(attrs.description)[0] ??
    undefined;

  // Tags that are genre group
  const genres = attrs.tags
    .filter((t) => t.attributes.group === "genre")
    .map((t) => t.attributes.name["en"] ?? Object.values(t.attributes.name)[0])
    .filter((name): name is string => Boolean(name));

  const poster = extractMangaCover(raw);

  return {
    id: `manga_${externalId}`,
    externalId,
    type: "manga",
    title,
    poster,
    year: attrs.year ?? undefined,
    synopsis,
    genres: genres.length > 0 ? genres : undefined,
    metadata: {
      status: attrs.status,
      lastChapter: attrs.lastChapter ?? undefined,
      lastVolume: attrs.lastVolume ?? undefined,
    },
  };
}

export function normalizeBookGoogle(raw: GoogleBooksVolume): MediaItem {
  const externalId = raw.id;
  const info = raw.volumeInfo;

  // Google Books rating is 0-5, normalize to 0-10
  const rating =
    info.averageRating !== undefined ? info.averageRating * 2 : undefined;

  return {
    id: `book_${externalId}`,
    externalId,
    type: "book",
    title: info.title,
    poster: (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail)?.replace(/^http:\/\//, 'https://'),
    year: extractYear(info.publishedDate),
    synopsis: info.description,
    genres: info.categories,
    rating,
    ratingSource: rating !== undefined ? "Google Books" : undefined,
    metadata: {
      authors: info.authors ?? [],
      publisher: info.publisher,
      pageCount: info.pageCount,
      language: info.language,
      isbn:
        info.industryIdentifiers?.find((i) => i.type === "ISBN_13")
          ?.identifier ??
        info.industryIdentifiers?.find((i) => i.type === "ISBN_10")
          ?.identifier,
    },
  };
}

export function normalizeBookOpenLibrary(raw: OpenLibraryDoc): MediaItem {
  // key is "/works/OL7353617W" — use the path as externalId
  const externalId = raw.key.replace(/^\/works\//, "");

  const poster = raw.cover_i ? openLibraryCover(raw.cover_i) : undefined;

  return {
    id: `book_${externalId}`,
    externalId,
    type: "book",
    title: raw.title,
    poster,
    year: raw.first_publish_year,
    genres: raw.subject?.slice(0, 5),
    metadata: {
      authors: raw.author_name ?? [],
    },
  };
}

export function normalizeGame(raw: RawgGame): MediaItem {
  const externalId = String(raw.id);

  // RAWG rating is 0-5, normalize to 0-10
  const rating = raw.rating > 0 ? raw.rating * 2 : undefined;

  const platforms =
    raw.platforms?.map((p) => p.platform.name) ?? [];
  const developers = raw.developers?.map((d) => d.name) ?? [];
  const publishers = raw.publishers?.map((p) => p.name) ?? [];

  return {
    id: `game_${externalId}`,
    externalId,
    type: "game",
    title: raw.name,
    poster: raw.background_image ?? undefined,
    year: extractYear(raw.released),
    synopsis: raw.description_raw,
    genres: raw.genres?.map((g) => g.name),
    rating,
    ratingSource: rating !== undefined ? "RAWG" : undefined,
    metadata: {
      metacritic: raw.metacritic ?? undefined,
      // playtime (horas medias) y tags (slugs) → usados por los post-filtros
      // game de E59 R4c-1 (duracionmedia, modojuego, estado). Omitidos si RAWG
      // no los reporta.
      playtime: typeof raw.playtime === "number" ? raw.playtime : undefined,
      tags: raw.tags?.map((t) => t.slug) ?? [],
      platforms,
      developers,
      publishers,
    },
  };
}

export function normalizeComic(raw: ComicVineIssue): MediaItem {
  const externalId = String(raw.id);
  const volume = raw.volume?.name ?? null;
  const issueLabel = raw.issue_number ? `#${raw.issue_number}` : null;
  const title =
    [volume, issueLabel, raw.name].filter(Boolean).join(" ") ||
    raw.name ||
    `Comic ${externalId}`;
  const cover =
    raw.image?.medium_url ??
    raw.image?.original_url ??
    raw.image?.small_url ??
    undefined;

  return {
    id: `comic_${externalId}`,
    externalId,
    type: "comic",
    title,
    poster: cover ?? undefined,
    year: extractYear(raw.cover_date ?? raw.store_date),
    synopsis: raw.deck || undefined,
    genres: [],
    ratingSource: "ComicVine",
  };
}
