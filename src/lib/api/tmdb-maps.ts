// ============================================================
// KULTURA — TMDB filter translation tables (E59 F3a)
// Traduce el contrato canónico de filtros (docs/E59_FILTER_SPEC.md) a los
// params nativos de /discover/{movie,tv}. Centraliza las tablas (género,
// plataforma, idioma, sort, rangos de año/duración, status) y expone un
// builder que produce el Record<string,string> que se pasa a tmdbFetch.
//
// Política de guard: toda entrada vacía / desconocida se IGNORA (no se añade
// el param), de modo que un valor inválido nunca rompe la query TMDB.
// ============================================================

import { valoracionThreshold } from "@/lib/api/valoracion";
import type { MediaItem } from "@/types/media";

export type TmdbMediaType = "movie" | "tv";

// ── Géneros ───────────────────────────────────────────────────────────────────
// Las listas de movie y tv son DISTINTAS en TMDB. Las claves son slugs canónicos
// Kultura (es, kebab para multi-palabra). Solo se incluyen géneros que existen en
// la lista TMDB correspondiente.

export const TMDB_GENRE_MOVIE: Record<string, number> = {
  accion: 28,
  aventura: 12,
  animacion: 16,
  comedia: 35,
  crimen: 80,
  documental: 99,
  drama: 18,
  familia: 10751,
  fantasia: 14,
  historia: 36,
  terror: 27,
  musica: 10402,
  misterio: 9648,
  romance: 10749,
  "ciencia-ficcion": 878,
  suspense: 53,
  belica: 10752,
  western: 37,
};

export const TMDB_GENRE_TV: Record<string, number> = {
  // TV agrupa acción/aventura y sci-fi/fantasía en géneros combinados propios.
  "accion-aventura": 10759,
  animacion: 16,
  comedia: 35,
  crimen: 80,
  documental: 99,
  drama: 18,
  familia: 10751,
  infantil: 10762,
  misterio: 9648,
  noticias: 10763,
  reality: 10764,
  "ciencia-ficcion-fantasia": 10765,
  telenovela: 10766,
  talk: 10767,
  "guerra-politica": 10768,
  western: 37,
};

// ── Plataformas (watch providers, región ES) ───────────────────────────────────
// slug canónico → provider_id TMDB. Mismos ids para movie y tv. Requiere
// watch_region=ES junto a with_watch_providers.

export const TMDB_WATCH_REGION = "ES";

export const TMDB_PROVIDER: Record<string, number> = {
  netflix: 8,
  "prime-video": 119,
  "disney-plus": 337,
  "hbo-max": 1899,
  "apple-tv": 350,
  "movistar-plus": 2241,
  filmin: 63,
  skyshowtime: 1773,
  crunchyroll: 283,
};

// ── Idioma (with_original_language) ────────────────────────────────────────────
// slug/etiqueta → ISO-639-1.

export const TMDB_LANGUAGE: Record<string, string> = {
  espanol: "es",
  ingles: "en",
  japones: "ja",
  frances: "fr",
  aleman: "de",
  italiano: "it",
  coreano: "ko",
  portugues: "pt",
  // Aliases por código directo (si ya viene el ISO, se acepta tal cual).
  es: "es",
  en: "en",
  ja: "ja",
  fr: "fr",
  de: "de",
  it: "it",
  ko: "ko",
  pt: "pt",
};

// ── Status TV (with_status, códigos 0–5) ───────────────────────────────────────
// movie NO tiene with_status en TMDB (ver E59_FILTER_SPEC §2) → status×movie OCULTO.
// Mapeamos nuestras 3 opciones canónicas a los códigos de producción de TMDB.
// Multi-código se une con "|" (OR) en with_status.

export const TMDB_TV_STATUS: Record<string, string> = {
  airing: "0", // Returning Series
  upcoming: "1|2", // Planned | In Production
  complete: "3|4", // Ended | Canceled
};

// ── Sort (sort_by) ──────────────────────────────────────────────────────────────
// El campo de fecha / título difiere entre movie y tv, así que se resuelve por tipo.

export const TMDB_SORT_MOVIE: Record<string, string> = {
  popularity: "popularity.desc",
  rating: "vote_average.desc",
  release_desc: "primary_release_date.desc",
  release_asc: "primary_release_date.asc",
  title_az: "original_title.asc",
  title_za: "original_title.desc",
};

export const TMDB_SORT_TV: Record<string, string> = {
  popularity: "popularity.desc",
  rating: "vote_average.desc",
  release_desc: "first_air_date.desc",
  release_asc: "first_air_date.asc",
  title_az: "original_name.asc",
  title_za: "original_name.desc",
};

export function tmdbSortBy(
  mediaType: TmdbMediaType,
  sort: string | null | undefined
): string {
  const table = mediaType === "movie" ? TMDB_SORT_MOVIE : TMDB_SORT_TV;
  return (sort && table[sort]) || "popularity.desc";
}

// ── Rango de año / década → fechas gte/lte ──────────────────────────────────────
// Soporta año exacto ("2024"), décadas ("2020s","2010s","2000s") y "classic" (<2000).

export interface YearRange {
  gte: string;
  lte: string;
}

export function tmdbYearRange(
  year: string | null | undefined
): YearRange | null {
  if (!year) return null;

  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const start = parseInt(decade[1], 10);
    return { gte: `${start}-01-01`, lte: `${start + 9}-12-31` };
  }

  if (year === "classic") {
    return { gte: "1900-01-01", lte: "1999-12-31" };
  }

  if (/^\d{4}$/.test(year)) {
    return { gte: `${year}-01-01`, lte: `${year}-12-31` };
  }

  return null; // desconocido → se ignora
}

// ── Duración (movie) → with_runtime gte/lte ─────────────────────────────────────
// Buckets canónicos. tv no usa duración (oculto).

// Buckets canónicos de duración (movie) → reflejan los slugs del switch de
// tmdbRuntimeRange. Solo value; el rango real lo resuelve tmdbRuntimeRange.
export const TMDB_DURACION: Record<string, true> = {
  short: true, // < 90 min
  medium: true, // 90–150 min
  long: true, // > 150 min
};

export interface RuntimeRange {
  gte?: string;
  lte?: string;
}

export function tmdbRuntimeRange(
  duracion: string | null | undefined
): RuntimeRange | null {
  switch (duracion) {
    case "short":
      return { lte: "89" }; // < 90 min
    case "medium":
      return { gte: "90", lte: "150" };
    case "long":
      return { gte: "151" }; // > 150 min
    default:
      return null;
  }
}

// ── Filtros de entrada (subconjunto del contrato canónico relevante a TMDB) ──────

export interface TmdbFilters {
  genre?: string[];
  year?: string | null;
  platform?: string[];
  sort?: string | null;
  status?: string | null;
  duracion?: string | null;
  idioma?: string | null;
  valoracion?: string | null;
  // R4c-2: temporadas×tv POST-filtro (no nativo en /discover/tv). No entra en el
  // builder ni gatea el fetch; se aplica sobre los MediaItem ya normalizados.
  temporadas?: string | null;
}

/** Traduce una lista de slugs a IDs vía `table`, descartando los desconocidos. */
function mapSlugs(
  slugs: string[] | undefined,
  table: Record<string, number>
): number[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => table[s])
    .filter((id): id is number => typeof id === "number");
}

/**
 * Construye el Record<string,string> de params nativos TMDB a partir de los
 * filtros canónicos. `sort_by` siempre se incluye (default popularity.desc).
 * Todo valor vacío/inválido se omite. with_genres usa OR (",") como el prototipo.
 */
export function buildTmdbDiscoverParams(
  mediaType: TmdbMediaType,
  filters: TmdbFilters = {}
): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: tmdbSortBy(mediaType, filters.sort),
    // Suelo de votos (E94): descarta contenido con muy pocos votos. Mismo umbral
    // ya validado en discoverByGenre (genre-news). Aplica a movie y tv.
    "vote_count.gte": "50",
  };

  // Género (listas distintas movie/tv; OR con coma).
  const genreTable = mediaType === "movie" ? TMDB_GENRE_MOVIE : TMDB_GENRE_TV;
  const genreIds = mapSlugs(filters.genre, genreTable);
  if (genreIds.length > 0) params.with_genres = genreIds.join(",");

  // Plataforma (watch providers, requiere watch_region).
  const providerIds = mapSlugs(filters.platform, TMDB_PROVIDER);
  if (providerIds.length > 0) {
    params.with_watch_providers = providerIds.join("|");
    params.watch_region = TMDB_WATCH_REGION;
  }

  // Idioma original.
  if (filters.idioma) {
    const iso = TMDB_LANGUAGE[filters.idioma];
    if (iso) params.with_original_language = iso;
  }

  // Año / década → rango de fechas (campo según tipo).
  const yr = tmdbYearRange(filters.year);
  if (yr) {
    if (mediaType === "movie") {
      params["primary_release_date.gte"] = yr.gte;
      params["primary_release_date.lte"] = yr.lte;
    } else {
      params["first_air_date.gte"] = yr.gte;
      params["first_air_date.lte"] = yr.lte;
    }
  }

  // Duración (solo movie).
  if (mediaType === "movie") {
    const rt = tmdbRuntimeRange(filters.duracion);
    if (rt) {
      if (rt.gte) params["with_runtime.gte"] = rt.gte;
      if (rt.lte) params["with_runtime.lte"] = rt.lte;
    }
  }

  // Status (solo tv; movie no tiene with_status → oculto).
  if (mediaType === "tv" && filters.status) {
    const code = TMDB_TV_STATUS[filters.status];
    if (code) params.with_status = code;
  }

  // Valoracion (nativo movie+tv): umbral mínimo → vote_average.gte (escala 0–10).
  const minVote = valoracionThreshold(filters.valoracion);
  if (minVote !== null) params["vote_average.gte"] = String(minVote);

  return params;
}

// ── POST-filtro temporadas×tv (R4c-2) ───────────────────────────────────────────
// TMDB /discover/tv no filtra por nº de temporadas → post-filtro sobre
// metadata.seasons (number_of_seasons). Catálogo R1: 1 / 2-3 / 4-6 / 7plus.
// Vacío/desconocido → no filtra. Items sin seasons numérico se descartan.

export const TEMPORADAS_BUCKETS: Record<
  string,
  { min: number; max: number }
> = {
  "1": { min: 1, max: 1 },
  "2-3": { min: 2, max: 3 },
  "4-6": { min: 4, max: 6 },
  "7plus": { min: 7, max: Infinity },
};

export function filterTVByTemporadas(
  items: MediaItem[],
  temporadas: string | null | undefined
): MediaItem[] {
  if (!temporadas || !(temporadas in TEMPORADAS_BUCKETS)) return items;
  const { min, max } = TEMPORADAS_BUCKETS[temporadas];
  return items.filter((item) => {
    const s = item.metadata?.seasons;
    return typeof s === "number" && s >= min && s <= max;
  });
}
