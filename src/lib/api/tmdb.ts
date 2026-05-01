// ============================================================
// KULTURA — TMDB API Integration
// Películas y series via The Movie Database API v3
// Docs: https://developer.themoviedb.org/reference/intro/getting-started
// ============================================================

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
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
  url.searchParams.set("language", "es-ES");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchMovies(
  query: string,
  page = 1
): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>("/search/movie", {
    query,
    page: String(page),
  });
}

export async function searchTV(
  query: string,
  page = 1
): Promise<TmdbTVSearchResponse> {
  return tmdbFetch<TmdbTVSearchResponse>("/search/tv", {
    query,
    page: String(page),
  });
}

export async function getMovie(id: number): Promise<TmdbMovieDetail> {
  return tmdbFetch<TmdbMovieDetail>(`/movie/${id}`, {
    append_to_response: "credits,videos,watch/providers",
  });
}

export async function getTV(id: number): Promise<TmdbTVDetail> {
  return tmdbFetch<TmdbTVDetail>(`/tv/${id}`, {
    append_to_response: "credits,videos,watch/providers",
  });
}

export async function getPopularMovies(page = 1): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>("/movie/popular", {
    page: String(page),
  });
}

export async function getPopularTV(page = 1): Promise<TmdbTVSearchResponse> {
  return tmdbFetch<TmdbTVSearchResponse>("/tv/popular", {
    page: String(page),
  });
}

export async function getTrendingMovies(
  timeWindow: "day" | "week" = "week"
): Promise<TmdbSearchResponse> {
  return tmdbFetch<TmdbSearchResponse>(`/trending/movie/${timeWindow}`);
}

export async function getMovieVideos(id: number): Promise<TmdbVideosResponse> {
  return tmdbFetch<TmdbVideosResponse>(`/movie/${id}/videos`);
}

export async function getTVVideos(id: number): Promise<TmdbVideosResponse> {
  return tmdbFetch<TmdbVideosResponse>(`/tv/${id}/videos`);
}

export async function getMovieProviders(
  id: number,
  region = "ES"
): Promise<TmdbProvidersResponse> {
  return tmdbFetch<TmdbProvidersResponse>(`/movie/${id}/watch/providers`, {
    region,
  });
}

export async function getTVProviders(
  id: number,
  region = "ES"
): Promise<TmdbProvidersResponse> {
  return tmdbFetch<TmdbProvidersResponse>(`/tv/${id}/watch/providers`, {
    region,
  });
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
  pageSize = 10
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
    const result = await tmdbFetch<TmdbSearchResponse>('/discover/movie', params)
    return { ...result, results: result.results.slice(0, pageSize) }
  } else {
    params['first_air_date.gte'] = `${currentYear - 1}-01-01`
    params['vote_count.gte'] = '20'
    const result = await tmdbFetch<TmdbTVSearchResponse>('/discover/tv', params)
    return { ...result, results: result.results.slice(0, pageSize) }
  }
}
