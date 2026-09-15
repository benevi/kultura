// ============================================================
// KULTURA — TMDB API Integration
// Películas y series via The Movie Database API v3
// Docs: https://developer.themoviedb.org/reference/intro/getting-started
// ============================================================

import { env } from "@/lib/env";
import { tmdbLanguage, tmdbRegion } from "@/lib/api/locale";

export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

export function tmdbPoster(path: string | null): string | undefined {
  return path ? `${TMDB_IMG_BASE}/w500${path}` : undefined;
}

export function tmdbBackdrop(path: string | null): string | undefined {
  return path ? `${TMDB_IMG_BASE}/w1280${path}` : undefined;
}

// ── Internal types ────────────────────────────────────────────────────────────

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string; // "YYYY-MM-DD"
  overview: string;
  vote_average: number; // 0-10
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
}

export interface TmdbMovieDetail extends TmdbMovie {
  runtime: number | null;
  genres: { id: number; name: string }[];
  credits?: {
    crew: { job: string; name: string }[];
    cast: { name: string }[];
  };
  videos?: TmdbVideosResponse;
  "watch/providers"?: TmdbProvidersResponse;
}

export interface TmdbTV {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string; // "YYYY-MM-DD"
  overview: string;
  vote_average: number; // 0-10
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  number_of_episodes?: number;
  number_of_seasons?: number;
}

export interface TmdbTVDetail extends TmdbTV {
  genres: { id: number; name: string }[];
  number_of_episodes: number;
  number_of_seasons: number;
  networks?: { name: string }[];
  status?: string;
  credits?: {
    crew: { job: string; name: string }[];
    cast: { name: string }[];
  };
  videos?: TmdbVideosResponse;
  "watch/providers"?: TmdbProvidersResponse;
}

export interface TmdbSearchResponse {
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
}

export interface TmdbTVSearchResponse {
  results: TmdbTV[];
  total_pages: number;
  total_results: number;
}

export interface TmdbVideosResponse {
  results: { key: string; site: string; type: string }[];
}

export interface TmdbProvider {
  provider_name: string;
  logo_path: string;
}

export interface TmdbProvidersResponse {
  results: Record<
    string,
    {
      flatrate?: TmdbProvider[];
      rent?: TmdbProvider[];
      buy?: TmdbProvider[];
    }
  >;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  locale?: string | null
): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  // E-TMDB-LOCALE: antes `es-ES` HARDCODEADO en toda petición → un usuario en
  // inglés recibía títulos/sinopsis en español. Ahora deriva del locale activo
  // (`tmdbLanguage`), con `es-ES` como default cuando no se pasa locale (paridad
  // con el comportamiento anterior para llamadas sin contexto de request).
  url.searchParams.set("language", tmdbLanguage(locale));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Géneros de los endpoints de LISTADO (E-TMDB-GENRES) ──────────────────────
//
// Bug real en producción: /discover, /search, /popular y /trending devuelven
// `genre_ids` (solo ids), mientras que `genres` con nombres SOLO llega en la
// ficha de detalle. `normalizeMovie`/`normalizeTV` leen `raw.genres`, así que
// todo item de listado llegaba SIN género. Como el género pesa el 70% del match
// score (`scoreItem`), cualquier card de película/serie daba 0% MATCH por muy
// buena que fuese la biblioteca del usuario — y lo mismo al cachear un título
// en `media.metadata.genres`.
//
// Se resuelve aquí, en el cliente, para que se cure en TODAS las superficies a
// la vez (Descubrir, buscador, filas de inicio, agregado y recomendaciones IA).

/** Catálogo id→nombre por tipo e idioma. TMDB casi nunca lo cambia → cache sin TTL. */
const genreNameCache = new Map<string, Map<number, string>>();

async function getGenreNames(
  kind: "movie" | "tv",
  locale?: string | null
): Promise<Map<number, string>> {
  const key = `${kind}:${tmdbLanguage(locale)}`;
  const cached = genreNameCache.get(key);
  if (cached) return cached;

  try {
    const res = await tmdbFetch<{ genres: { id: number; name: string }[] }>(
      `/genre/${kind}/list`,
      {},
      locale
    );
    const names = new Map(res.genres.map((g) => [g.id, g.name]));
    genreNameCache.set(key, names);
    return names;
  } catch {
    // Sin catálogo los items salen sin género (comportamiento previo), pero NO
    // se cachea el fallo: la siguiente petición vuelve a intentarlo.
    return new Map();
  }
}

interface WithGenres {
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
}

/** Rellena `genres` a partir de `genre_ids` en una respuesta de listado. */
async function hydrateGenres<T extends WithGenres, R extends { results: T[] }>(
  response: R,
  kind: "movie" | "tv",
  locale?: string | null
): Promise<R> {
  const results = response.results ?? [];
  const needsHydration = results.some(
    (item) => !item.genres?.length && item.genre_ids?.length
  );
  if (!needsHydration) return response;

  const names = await getGenreNames(kind, locale);
  if (names.size === 0) return response;

  return {
    ...response,
    results: results.map((item) => {
      if (item.genres?.length || !item.genre_ids?.length) return item;
      const genres = item.genre_ids
        .map((id) => ({ id, name: names.get(id) }))
        .filter((g): g is { id: number; name: string } => Boolean(g.name));
      return genres.length > 0 ? { ...item, genres } : item;
    }),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

// E-TMDB-LOCALE: todas las funciones públicas aceptan un `locale` OPCIONAL como
// último parámetro. Omitirlo mantiene `es-ES` (paridad con el comportamiento
// pre-E-TMDB-LOCALE) para call sites sin contexto de request.

export async function searchMovies(
  query: string,
  page = 1,
  locale?: string | null
): Promise<TmdbSearchResponse> {
  const res = await tmdbFetch<TmdbSearchResponse>(
    "/search/movie",
    { query, page: String(page) },
    locale
  );
  return hydrateGenres(res, "movie", locale);
}

export async function searchTV(
  query: string,
  page = 1,
  locale?: string | null
): Promise<TmdbTVSearchResponse> {
  const res = await tmdbFetch<TmdbTVSearchResponse>(
    "/search/tv",
    { query, page: String(page) },
    locale
  );
  return hydrateGenres(res, "tv", locale);
}

export async function getMovie(
  id: number,
  locale?: string | null
): Promise<TmdbMovieDetail> {
  return tmdbFetch<TmdbMovieDetail>(
    `/movie/${id}`,
    { append_to_response: "credits,videos,watch/providers" },
    locale
  );
}

export async function getTV(
  id: number,
  locale?: string | null
): Promise<TmdbTVDetail> {
  return tmdbFetch<TmdbTVDetail>(
    `/tv/${id}`,
    { append_to_response: "credits,videos,watch/providers" },
    locale
  );
}

export async function getPopularMovies(
  page = 1,
  locale?: string | null
): Promise<TmdbSearchResponse> {
  const res = await tmdbFetch<TmdbSearchResponse>(
    "/movie/popular",
    { page: String(page) },
    locale
  );
  return hydrateGenres(res, "movie", locale);
}

export async function getPopularTV(
  page = 1,
  locale?: string | null
): Promise<TmdbTVSearchResponse> {
  const res = await tmdbFetch<TmdbTVSearchResponse>(
    "/tv/popular",
    { page: String(page) },
    locale
  );
  return hydrateGenres(res, "tv", locale);
}

/**
 * Descubre películas vía /discover/movie. E59: reemplaza a getPopularMovies en
 * el flujo de Descubrir para habilitar filtros nativos (with_genres, sort_by,
 * primary_release_date.gte/lte…). Con sort_by=popularity.desc por defecto el
 * comportamiento es equivalente a /movie/popular (misma paginación).
 * `params` extra se pasan tal cual a TMDB (para F3+).
 */
export async function discoverMovies(
  page = 1,
  params: Record<string, string> = {},
  locale?: string | null
): Promise<TmdbSearchResponse> {
  const res = await tmdbFetch<TmdbSearchResponse>(
    "/discover/movie",
    {
      sort_by: "popularity.desc",
      include_adult: "false", // E86: explícito (default TMDB ya es false, lo fijamos)
      page: String(page),
      ...params,
    },
    locale
  );
  return hydrateGenres(res, "movie", locale);
}

/**
 * Descubre series vía /discover/tv. Equivalente a /tv/popular con
 * sort_by=popularity.desc. NOTA E59: /discover/tv NO devuelve
 * number_of_seasons (solo genre_ids/fechas/idioma) — el filtro "temporadas"
 * exigiría una llamada de detalle por ítem (N+1), por eso queda oculto en F1.
 */
export async function discoverTV(
  page = 1,
  params: Record<string, string> = {},
  locale?: string | null
): Promise<TmdbTVSearchResponse> {
  const res = await tmdbFetch<TmdbTVSearchResponse>(
    "/discover/tv",
    {
      sort_by: "popularity.desc",
      include_adult: "false", // E86: explícito (default TMDB ya es false, lo fijamos)
      page: String(page),
      ...params,
    },
    locale
  );
  return hydrateGenres(res, "tv", locale);
}

export async function getTrendingMovies(
  timeWindow: "day" | "week" = "week",
  locale?: string | null
): Promise<TmdbSearchResponse> {
  const res = await tmdbFetch<TmdbSearchResponse>(
    `/trending/movie/${timeWindow}`,
    {},
    locale
  );
  return hydrateGenres(res, "movie", locale);
}

export async function getMovieVideos(
  id: number,
  locale?: string | null
): Promise<TmdbVideosResponse> {
  return tmdbFetch<TmdbVideosResponse>(`/movie/${id}/videos`, {}, locale);
}

export async function getTVVideos(
  id: number,
  locale?: string | null
): Promise<TmdbVideosResponse> {
  return tmdbFetch<TmdbVideosResponse>(`/tv/${id}/videos`, {}, locale);
}

// Providers: `region` gobierna el CATÁLOGO de streaming (oferta por país), no el
// idioma. E-TMDB-LOCALE lo deriva del locale (`es`→ES, `en`→US) cuando no se
// pasa explícito, en vez de servir siempre la oferta española.
export async function getMovieProviders(
  id: number,
  region?: string,
  locale?: string | null
): Promise<TmdbProvidersResponse> {
  return tmdbFetch<TmdbProvidersResponse>(
    `/movie/${id}/watch/providers`,
    { region: region ?? tmdbRegion(locale) },
    locale
  );
}

export async function getTVProviders(
  id: number,
  region?: string,
  locale?: string | null
): Promise<TmdbProvidersResponse> {
  return tmdbFetch<TmdbProvidersResponse>(
    `/tv/${id}/watch/providers`,
    { region: region ?? tmdbRegion(locale) },
    locale
  );
}

/**
 * TMDB genre name → ID map (es-ES).
 * Cubre los géneros más frecuentes que devuelve TMDB en español.
 */
export const TMDB_GENRE_MAP: Record<string, number> = {
  Acción: 28,
  Aventura: 12,
  Animación: 16,
  Comedia: 35,
  Crimen: 80,
  Documental: 99,
  Drama: 18,
  Familia: 10751,
  Fantasía: 14,
  Historia: 36,
  Terror: 27,
  Música: 10402,
  Misterio: 9648,
  Romance: 10749,
  'Ciencia ficción': 878,
  Suspense: 53,
  Thriller: 53,
  Bélica: 10752,
  Western: 37,
  // Aliases en inglés (fallback si los géneros del usuario vienen en inglés)
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Mystery: 9648,
  'Science Fiction': 878,
  War: 10752,
}

/**
 * Descubre películas o series recientes filtradas por género TMDB.
 * Devuelve hasta `pageSize` resultados del año actual o anterior.
 */
export async function discoverByGenre(
  mediaType: 'movie' | 'tv',
  genreIds: number[],
  pageSize = 10,
  locale?: string | null
): Promise<TmdbSearchResponse | TmdbTVSearchResponse> {
  const currentYear = new Date().getFullYear()

  const params: Record<string, string> = {
    sort_by: 'popularity.desc',
    with_genres: genreIds.join(','),
    page: '1',
  }

  if (mediaType === 'movie') {
    // Películas del año actual o del anterior
    params['primary_release_date.gte'] = `${currentYear - 1}-01-01`
    params['vote_count.gte'] = '50'
    const result = await tmdbFetch<TmdbSearchResponse>('/discover/movie', params, locale)
    return hydrateGenres({ ...result, results: result.results.slice(0, pageSize) }, 'movie', locale)
  } else {
    params['first_air_date.gte'] = `${currentYear - 1}-01-01`
    params['vote_count.gte'] = '20'
    const result = await tmdbFetch<TmdbTVSearchResponse>('/discover/tv', params, locale)
    return hydrateGenres({ ...result, results: result.results.slice(0, pageSize) }, 'tv', locale)
  }
}
