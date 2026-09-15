// ============================================================
// KULTURA — AniList filter translation tables (E-ANIME-SOURCE)
// Traduce el contrato canónico de filtros de anime (mismos slugs que ya
// consumía Jikan — reutilizados por la UI existente, ver filter-options.ts)
// a los params nativos de la query GraphQL de AniList (anilist.ts).
//
// demografia (shonen/shoujo/seinen/josei/kids): SIN equivalente fiable en
// AniList — su taxonomía de tags no tiene una categoría "demografía" (a
// diferencia de MangaDex, que sí expone `publicationDemographic` como campo
// real). Política A del proyecto ("nunca un trigger que mienta"): el
// trigger `demografia` se retira de `TYPE_FILTERS.anime` en vez de dejar un
// filtro visible que nunca filtra nada — ver type-filters.ts.
// ============================================================

import { valoracionThreshold } from "@/lib/api/valoracion";
import type { AniListDiscoverParams } from "@/lib/api/anilist";

export interface AniListFilters {
  genre?: string[];
  year?: string | null;
  status?: string | null;
  sort?: string | null;
  valoracion?: string | null;
}

// slug canónico (mismo set que JIKAN_GENRE, reusado por GENRE_BY_TYPE.anime
// en filter-options.ts) → nombre de género literal de AniList (su schema usa
// el nombre en inglés tal cual, no un id numérico — nada que verificar en
// vivo, a diferencia de los tag UUID de MangaDex).
export const ANILIST_GENRE: Record<string, string> = {
  accion: "Action",
  aventura: "Adventure",
  comedia: "Comedy",
  drama: "Drama",
  fantasia: "Fantasy",
  terror: "Horror",
  misterio: "Mystery",
  romance: "Romance",
  "ciencia-ficcion": "Sci-Fi",
  "recuentos-de-la-vida": "Slice of Life",
  deportes: "Sports",
  sobrenatural: "Supernatural",
  suspense: "Thriller", // AniList no distingue "Suspense" de "Thriller"
};

// canónico (ANIME_STATUS de jikan-maps, reusado por STATUS_BY_TYPE.anime) →
// MediaStatus de AniList. Cobertura completa (a diferencia de MangaDex, los
// 3 valores canónicos de anime tienen equivalente exacto).
export const ANILIST_STATUS: Record<string, string> = {
  airing: "RELEASING",
  complete: "FINISHED",
  upcoming: "NOT_YET_RELEASED",
};

// canónico → MediaSort de AniList. order siempre presente (default popularity).
const ANILIST_SORT: Record<string, string> = {
  popularity: "POPULARITY_DESC",
  rating: "SCORE_DESC",
  release_desc: "START_DATE_DESC",
  release_asc: "START_DATE",
  title_az: "TITLE_ROMAJI",
  title_za: "TITLE_ROMAJI_DESC",
};

function anilistSort(sort: string | null | undefined): string {
  return (sort && ANILIST_SORT[sort]) || ANILIST_SORT.popularity;
}

// ── Año / década → startDate_greater/lesser (FuzzyDateInt YYYYMMDD) ───────────
// Mismo contrato que jikanDateRange (jikan-maps.ts): decenio ("1990s"),
// "classic" (1900-1999) o año exacto → rango. AniList no tiene un operador de
// "año exacto" de rango (solo `seasonYear` como igualdad estricta, que exigiría
// un camino aparte para exact-year vs década) — un rango cubre los 3 casos con
// la misma fórmula, más simple de mantener y de testear.

export interface AniListDateRange {
  startDate_greater: number;
  startDate_lesser: number;
}

function rangeBounds(startYear: number, endYear: number): AniListDateRange {
  return {
    startDate_greater: (startYear - 1) * 10000 + 1231,
    startDate_lesser: (endYear + 1) * 10000 + 101,
  };
}

export function aniListDateRange(
  year: string | null | undefined
): AniListDateRange | null {
  if (!year) return null;

  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const start = parseInt(decade[1], 10);
    return rangeBounds(start, start + 9);
  }

  if (year === "classic") return rangeBounds(1900, 1999);

  if (/^\d{4}$/.test(year)) {
    const y = parseInt(year, 10);
    return rangeBounds(y, y);
  }

  return null;
}

/**
 * Construye los params nativos de la query de descubrir/buscar de AniList.
 * `sort` siempre presente (default popularity). Vacío/desconocido se omite
 * sin romper la query (nunca lanza).
 */
export function buildAniListDiscoverParams(
  filters: AniListFilters = {}
): AniListDiscoverParams {
  const genre_in = (filters.genre ?? [])
    .map((slug) => ANILIST_GENRE[slug])
    .filter((g): g is string => Boolean(g));

  const status = filters.status ? ANILIST_STATUS[filters.status] : undefined;

  const range = aniListDateRange(filters.year);

  // Valoracion (nativo, 0-10 canónico → 0-100 de AniList): AniList solo
  // ofrece "_greater" (estrictamente mayor que), no un "_greater_or_equal" →
  // se resta 1 al umbral*10 para aproximar "≥ umbral" con "> umbral*10 - 1".
  const minScore = valoracionThreshold(filters.valoracion);

  return {
    genre_in: genre_in.length > 0 ? genre_in : undefined,
    status,
    startDate_greater: range?.startDate_greater,
    startDate_lesser: range?.startDate_lesser,
    sort: [anilistSort(filters.sort)],
    averageScore_greater: minScore !== null ? minScore * 10 - 1 : undefined,
  };
}
