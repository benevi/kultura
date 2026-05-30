// ============================================================
// KULTURA — Tipos de Media
// Fuente de verdad para todos los títulos normalizados.
// Todas las APIs externas se normalizan a MediaItem antes
// de llegar a cualquier componente UI.
// ============================================================

/** Los 7 tipos de contenido cultural que soporta KULTURA */
export type MediaType =
  | "movie"
  | "tv"
  | "anime"
  | "book"
  | "comic"
  | "manga"
  | "game";

/** Estados de seguimiento en la biblioteca personal */
export type MediaStatus =
  | "completed"
  | "in_progress"
  | "pending"
  | "abandoned";

/** Fuentes de rating externo */
export type RatingSource =
  | "TMDB"
  | "MAL"
  | "Metacritic"
  | "ComicVine"
  | "Google Books"
  | "RAWG";

/** Tipo de acceso a un proveedor de streaming */
export type StreamingType = "flatrate" | "rent" | "buy" | "free" | "ads";

/** Proveedor de streaming donde está disponible el título */
export interface StreamingProvider {
  name: string;
  logoPath: string;
  type: StreamingType;
  url?: string;
}

/**
 * Tipo normalizado único para todos los títulos de KULTURA.
 *
 * El campo `id` sigue siempre el formato "{type}_{externalId}".
 * Ejemplo: "movie_550", "anime_1535", "book_OL7353617M"
 *
 * El campo `metadata` es intencionalmente abierto (Record<string, unknown>)
 * para almacenar datos específicos de cada tipo sin perder type-safety
 * en el resto de campos. Ejemplos:
 * - movie/tv: { runtime, director, cast[] }
 * - anime/manga: { episodes, status, studio }
 * - book: { author, pages, publisher, isbn }
 * - game: { platforms[], developer, metacritic }
 */
export interface MediaItem {
  /** Identificador único: "{type}_{externalId}" */
  id: string;
  /** ID en la API de origen */
  externalId: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  synopsis?: string;
  genres?: string[];
  /** Rating externo de la fuente de origen */
  rating?: number;
  ratingSource?: RatingSource;
  /** YouTube key para el tráiler embed */
  trailerKey?: string;
  streamingProviders?: StreamingProvider[];
  /**
   * Datos extra específicos del tipo de contenido.
   * Intencionalmente flexible — los tipos específicos por API
   * se documentan en lib/api/ junto a cada integración.
   */
  metadata?: Record<string, unknown>;
}

// ── ComicVine raw types (cómics, server-only) ─────────────────────────────────

export interface ComicVineIssue {
  id: number;
  name: string | null;
  issue_number: string | null;
  cover_date: string | null;
  store_date: string | null;
  deck: string | null;
  description: string | null;
  image: {
    medium_url?: string | null;
    small_url?: string | null;
    original_url?: string | null;
  } | null;
  volume: { name: string } | null;
}

export interface ComicVineSearchResponse {
  status_code: number;
  error: string;
  number_of_total_results: number;
  results: ComicVineIssue[];
}
