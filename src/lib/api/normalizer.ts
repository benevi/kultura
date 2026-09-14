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
import type { AniListMedia } from "./anilist";
import { toAniListRef } from "./anilist";
import type { MangaDexManga } from "./mangadex";
import { extractMangaCover } from "./mangadex";
import { pickLocalizedText } from "./locale";
import type { OpenLibraryDoc } from "./openlibrary";
import { openLibraryCover } from "./openlibrary";
import type { GoogleBooksVolume } from "./googlebooks";
import { googleBooksCover } from "./googlebooks";
import type { RawgGame } from "./rawg";
import type { ComicVineIssue } from "@/types/media";

// ── Provider helper ───────────────────────────────────────────────────────────

function extractProviders(
  providersResp: TmdbProvidersResponse | undefined,
  region = "ES"
): StreamingProvider[] | undefined {
  const es = providersResp?.results?.[region];
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

/** Limpia el HTML básico (`<br>`, entidades) que AniList puede dejar en
 * `description` incluso pidiendo `asHtml: false`. `null`/vacío → undefined
 * (nunca cadena vacía, para que el resto del código trate "sin sinopsis" de
 * forma uniforme). */
function stripAniListHtml(html: string | null): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  return text.length > 0 ? text : undefined;
}

/**
 * AniList → MediaItem (E-ANIME-SOURCE). `externalId` lleva el prefijo `al-`
 * (`toAniListRef`) para no colisionar con bibliotecas guardadas cuando anime
 * venía de Jikan (`mal_id`, entero plano) — mismo mecanismo que
 * `normalizeMangaDex` frente a los ids numéricos legacy de Jikan en manga.
 */
export function normalizeAniListAnime(raw: AniListMedia): MediaItem {
  const externalId = toAniListRef(raw.id);
  const title = raw.title.english ?? raw.title.romaji ?? raw.title.native ?? "Unknown";

  return {
    id: `anime_${externalId}`,
    externalId,
    type: "anime",
    title,
    originalTitle:
      raw.title.romaji && raw.title.romaji !== title ? raw.title.romaji : undefined,
    poster: raw.coverImage?.extraLarge || raw.coverImage?.large || undefined,
    year: raw.seasonYear ?? raw.startDate?.year ?? undefined,
    synopsis: stripAniListHtml(raw.description),
    genres: raw.genres?.length ? raw.genres : undefined,
    rating: raw.averageScore != null ? raw.averageScore / 10 : undefined,
    ratingSource: "AniList",
    trailerKey: raw.trailer?.site === "youtube" ? raw.trailer.id : undefined,
    metadata: {
      episodes: raw.episodes ?? undefined,
      status: raw.status,
      studio: raw.studios?.nodes?.[0]?.name ?? undefined,
      source: raw.source ?? undefined,
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

/**
 * MangaDex → MediaItem. `locale` (E-MANGADEX-LOCALE): idioma activo de la app.
 *
 * MangaDex entrega `title`, `description` y los nombres de tag como
 * diccionarios `{ código: texto }`. Antes se leía SIEMPRE `["en"]`, así que un
 * usuario en español veía título y sinopsis en inglés incluso cuando había
 * versión española. Ahora se resuelven con `pickLocalizedText`, cuya cadena de
 * fallback (idioma activo → inglés → romanización → primer valor) garantiza que
 * nunca se pierde el dato por falta de traducción.
 */
export function normalizeMangaDex(
  raw: MangaDexManga,
  locale?: string | null
): MediaItem {
  const externalId = raw.id;
  const attrs = raw.attributes;

  const title = pickLocalizedText(attrs.title, locale) ?? "Unknown";

  const synopsis = pickLocalizedText(attrs.description, locale);

  // Tags del grupo "genre", con el nombre en el idioma activo si existe.
  const genres = attrs.tags
    .filter((t) => t.attributes.group === "genre")
    .map((t) => pickLocalizedText(t.attributes.name, locale))
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
      // `volumes` numérico (mismo campo que normalizeMangaJikan) para que el
      // post-filtro compartido `filterByMinVolumes` (jikan-maps.ts) funcione
      // igual sea cual sea la fuente. MangaDex entrega `lastVolume` como
      // STRING (o null) — se parsea, y se descarta si no es un número real.
      volumes: attrs.lastVolume ? parseVolumeNumber(attrs.lastVolume) : undefined,
    },
  };
}

function parseVolumeNumber(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Google Books → MediaItem (E-BOOKS-GOOGLE). Fuente principal de libros.
 *
 * Notas de shape (todos los campos de `volumeInfo` son opcionales en la API):
 *  - `title` puede faltar en volúmenes basura → "Unknown" (el grid nunca pinta
 *    una card sin título).
 *  - `publishedDate` viene como "2003" o "2003-05-01" → se extrae el año.
 *  - `averageRating` es 0-5 → se normaliza a 0-10 como el resto de MediaItem
 *    (RAWG hace lo mismo). `ratingsCount` viaja en metadata.
 *  - `description` es la sinopsis (Open Library no la traía en el listado: esto
 *    es parte del motivo de la vuelta a Google Books).
 */
export function normalizeBookGoogle(raw: GoogleBooksVolume): MediaItem {
  const externalId = raw.id;
  const info = raw.volumeInfo ?? {};

  const year = extractYear(info.publishedDate);
  const rating =
    typeof info.averageRating === "number" && info.averageRating > 0
      ? info.averageRating * 2
      : undefined;

  return {
    id: `book_${externalId}`,
    externalId,
    type: "book",
    title: info.title ?? "Unknown",
    poster: googleBooksCover(info.imageLinks),
    year,
    synopsis: info.description ?? undefined,
    genres: info.categories?.slice(0, 5),
    rating,
    ratingSource: rating !== undefined ? "Google Books" : undefined,
    metadata: {
      authors: info.authors ?? [],
      publisher: info.publisher,
      language: info.language,
      pageCount: info.pageCount,
      ratingsCount: info.ratingsCount,
      subtitle: info.subtitle,
    },
  };
}

/**
 * Open Library → MediaItem. LEGACY (E-BOOKS-GOOGLE): los libros se sirven con
 * Google Books; esto solo resuelve las fichas de ids `book_OL…` ya guardados en
 * bibliotecas mientras Open Library fue la fuente (E84b/E84c). No se usa en
 * Descubrir ni en la búsqueda.
 */
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
    // rating: undefined (valoración de libros oculta)
    metadata: {
      authors: raw.author_name ?? [],
      publisher: raw.publisher?.[0],
      language: raw.language?.[0],
      // E-BOOKS-HIBRIDO: el ISBN viaja para poder puentear a Google Books en la
      // ficha (portada y sinopsis) sin emparejar por título, que es ambiguo
      // entre ediciones.
      isbn: raw.isbn ?? [],
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
