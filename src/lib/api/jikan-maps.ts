// ============================================================
// KULTURA — Jikan filter translation tables (E59 F3b)
// Traduce el contrato canónico (docs/E59_FILTER_SPEC.md) a los params nativos
// de /anime y /manga (endpoints de búsqueda, que aceptan filtros — /top/* no).
//
// Guard: vacío / desconocido se ignora. order_by/sort siempre presentes.
// ============================================================

import type { MediaItem } from "@/types/media";
import { valoracionThreshold } from "@/lib/api/valoracion";

export type JikanMediaType = "anime" | "manga";

// ── Géneros (MAL genre IDs) ─────────────────────────────────────────────────────
// Mismos IDs para anime y manga en MyAnimeList. slug canónico Kultura → MAL ID.
// genres admite CSV; usamos coma = OR (alineado al prototipo).

export const JIKAN_GENRE: Record<string, number> = {
  accion: 1, // Action
  aventura: 2, // Adventure
  comedia: 4, // Comedy
  drama: 8, // Drama
  fantasia: 10, // Fantasy
  terror: 14, // Horror
  misterio: 7, // Mystery
  romance: 22, // Romance
  "ciencia-ficcion": 24, // Sci-Fi
  "recuentos-de-la-vida": 36, // Slice of Life
  deportes: 30, // Sports
  sobrenatural: 37, // Supernatural
  suspense: 41, // Suspense (Thriller en MAL v4)
};

// ── Demografía (también son genre IDs MAL) ──────────────────────────────────────

export const JIKAN_DEMOGRAPHIC: Record<string, number> = {
  shonen: 27, // Shounen
  shojo: 25, // Shoujo
  seinen: 42, // Seinen
  josei: 43, // Josei
  kids: 15, // Kids
};

// ── Status — VALORES DISTINTOS por subtipo ──────────────────────────────────────
// Anime: airing | complete | upcoming.
// Manga: publishing | complete | hiatus | discontinued | upcoming.
// Nuestro contrato canónico de status es airing/complete/upcoming (anime-céntrico).
// Para manga: "airing" (en curso) se mapea a "publishing"; complete/upcoming 1:1.
// Los estados solo-manga (hiatus/discontinued) NO tienen clave canónica → se
// aceptan como passthrough si llegan literalmente, pero no se derivan de canónico.

export const ANIME_STATUS: Record<string, string> = {
  airing: "airing",
  complete: "complete",
  upcoming: "upcoming",
};

export const MANGA_STATUS: Record<string, string> = {
  airing: "publishing", // canónico "en emisión" → manga "publishing"
  complete: "complete",
  upcoming: "upcoming",
  // passthrough nativos de manga (sin clave canónica equivalente):
  publishing: "publishing",
  hiatus: "hiatus",
  discontinued: "discontinued",
};

export function jikanStatus(
  mediaType: JikanMediaType,
  status: string | null | undefined
): string | null {
  if (!status) return null;
  const table = mediaType === "anime" ? ANIME_STATUS : MANGA_STATUS;
  return table[status] ?? null; // desconocido para el subtipo → descartado
}

// ── Sort → order_by + sort ──────────────────────────────────────────────────────
// Jikan separa el campo (order_by) de la dirección (sort: asc|desc).

interface JikanSort {
  order_by: string;
  sort: string;
}

export const JIKAN_SORT: Record<string, JikanSort> = {
  popularity: { order_by: "popularity", sort: "asc" }, // rank 1 = más popular
  rating: { order_by: "score", sort: "desc" },
  release_desc: { order_by: "start_date", sort: "desc" },
  release_asc: { order_by: "start_date", sort: "asc" },
  title_az: { order_by: "title", sort: "asc" },
  title_za: { order_by: "title", sort: "desc" },
};

export function jikanSort(sort: string | null | undefined): JikanSort {
  return (sort && JIKAN_SORT[sort]) || JIKAN_SORT.popularity;
}

// ── Año / década → start_date / end_date (YYYY-MM-DD) ───────────────────────────

export interface JikanDateRange {
  start_date: string;
  end_date: string;
}

export function jikanDateRange(
  year: string | null | undefined
): JikanDateRange | null {
  if (!year) return null;

  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const start = parseInt(decade[1], 10);
    return { start_date: `${start}-01-01`, end_date: `${start + 9}-12-31` };
  }

  if (year === "classic") {
    return { start_date: "1900-01-01", end_date: "1999-12-31" };
  }

  if (/^\d{4}$/.test(year)) {
    return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
  }

  return null;
}

// ── Filtros de entrada (subconjunto canónico relevante a Jikan) ──────────────────

export interface JikanFilters {
  genre?: string[];
  demografia?: string | null;
  year?: string | null;
  status?: string | null;
  sort?: string | null;
  valoracion?: string | null;
  // Solo manga, POST-filtro (no es param nativo de Jikan): se aplica sobre los
  // items ya normalizados, no entra en buildJikanDiscoverParams. anime → oculto.
  volumenes?: string | null;
}

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
 * Construye los params nativos de /anime o /manga. order_by+sort siempre
 * presentes. genres (género + demografía) en un único CSV (OR). Vacío/inválido
 * se omite. Devuelve {} salvo order_by/sort si no hay filtros reales — el caller
 * decide si usar este builder o /top/* según hasJikanFilters.
 */
export function buildJikanDiscoverParams(
  mediaType: JikanMediaType,
  filters: JikanFilters = {}
): Record<string, string> {
  const params: Record<string, string> = {};

  const { order_by, sort } = jikanSort(filters.sort);
  params.order_by = order_by;
  params.sort = sort;

  // Género + demografía van juntos en `genres` (ambos son genre IDs MAL).
  const ids = mapSlugs(filters.genre, JIKAN_GENRE);
  if (filters.demografia) {
    const demoId = JIKAN_DEMOGRAPHIC[filters.demografia];
    if (typeof demoId === "number") ids.push(demoId);
  }
  if (ids.length > 0) params.genres = ids.join(",");

  const status = jikanStatus(mediaType, filters.status);
  if (status) params.status = status;

  const range = jikanDateRange(filters.year);
  if (range) {
    params.start_date = range.start_date;
    params.end_date = range.end_date;
  }

  // Valoracion (nativo anime+manga): umbral mínimo → min_score (escala 0–10).
  const minScore = valoracionThreshold(filters.valoracion);
  if (minScore !== null) params.min_score = String(minScore);

  return params;
}

/**
 * True si los filtros implican usar el endpoint de búsqueda (/anime|/manga)
 * en vez de /top/*. Un sort distinto del default popularity también cuenta,
 * porque /top/* no admite order_by.
 */
export function hasJikanFilters(filters: JikanFilters = {}): boolean {
  return Boolean(
    filters.genre?.length ||
      filters.demografia ||
      filters.year ||
      filters.status ||
      filters.valoracion ||
      (filters.sort && filters.sort !== "popularity")
  );
}

// ── Volúmenes (manga) — POST-filtro de mínimo ───────────────────────────────────
// Buckets canónicos (spec §1/§3): "1-5"/"6-20"/"20plus" → umbral mínimo de volumes.
// kind "min": se conserva el manga cuyo volumes >= umbral. Solo manga (anime oculto).

export const VOLUMENES_MIN: Record<string, number> = {
  "1-5": 1,
  "6-20": 6,
  "20plus": 20,
};

/** Umbral mínimo de volúmenes para un bucket canónico, o null si desconocido. */
export function volumenesMin(bucket: string | null | undefined): number | null {
  if (!bucket) return null;
  return VOLUMENES_MIN[bucket] ?? null;
}

/**
 * Post-filtra items de manga por mínimo de volúmenes. Conserva solo los que tienen
 * `metadata.volumes` numérico y >= umbral del bucket. Bucket vacío/desconocido →
 * devuelve los items intactos (no filtra). Items sin volumes resuelto se descartan.
 */
export function filterByMinVolumes(
  items: MediaItem[],
  bucket: string | null | undefined
): MediaItem[] {
  const min = volumenesMin(bucket);
  if (min === null) return items;
  return items.filter((item) => {
    const v = item.metadata?.volumes;
    return typeof v === "number" && v >= min;
  });
}
