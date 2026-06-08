// ============================================================
// KULTURA — Discover modo "all" (agregado) · E59 R5a (BACKEND ONLY)
// Fan-out a las 7 familias vía fetchDiscoverData (reusa todos los builders,
// normalizadores y post-filtros existentes), luego merge + orden según sortKey.
//
// NO reimplementa pipeline: cada familia se resuelve por su rama nativa en
// discover.ts. Aquí solo se combinan los DiscoverResult.
//
// Filtros válidos en "all" (TYPE_FILTERS.all): genero / anio / valoracion /
// plataforma / sort. Las familias que no consumen `platform`
// (book/manga/comic/anime) la ignoran en sus builders sin romper.
// ============================================================

import { fetchDiscoverData, type DiscoverFilters } from "@/lib/api/discover";
import type { DiscoverResult, FetchErrorKind } from "@/lib/api/discover";
import type { MediaItem } from "@/types/media";

/** Familias agregadas, en orden canónico (= orden de interleave popularity). */
export const FAMILIES = [
  "movie",
  "tv",
  "anime",
  "book",
  "manga",
  "game",
  "comic",
] as const;

/** Tamaño de página del agregado (paridad con el page-size por familia). */
export const PAGE_SIZE = 20;

/** Sort canónicos válidos en "all" (claves base TMDB_SORT_MOVIE). */
type SortKey = "popularity" | "rating" | "recent" | "title_az";

/**
 * Round-robin entre listas (preserva el orden nativo de cada una). Recorre por
 * rondas: 1er elemento de cada lista en orden, luego 2º, etc. Listas vacías se
 * saltan. Usado para `popularity`, donde no hay clave global comparable.
 */
function interleave(lists: MediaItem[][]): MediaItem[] {
  const out: MediaItem[] = [];
  const maxLen = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}

/**
 * Combina las listas por familia según el sortKey:
 *  - rating:   aplana y ordena desc por rating.
 *  - recent:   aplana y ordena desc por year.
 *  - title_az: aplana y ordena por title (localeCompare 'es').
 *  - popularity (y default): interleave round-robin, preservando orden nativo.
 */
function mergeBySort(lists: MediaItem[][], sortKey: SortKey): MediaItem[] {
  switch (sortKey) {
    case "rating": {
      const flat = lists.flat();
      return flat.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    case "recent": {
      const flat = lists.flat();
      return flat.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    }
    case "title_az": {
      const flat = lists.flat();
      return flat.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", "es")
      );
    }
    case "popularity":
    default:
      return interleave(lists);
  }
}

/** Normaliza el sort de entrada a un SortKey válido (default popularity). */
function resolveSortKey(sort: string | null | undefined): SortKey {
  if (sort === "rating" || sort === "recent" || sort === "title_az") {
    return sort;
  }
  return "popularity";
}

/**
 * Modo "all": resuelve las 7 familias en paralelo y combina sus resultados.
 *
 * - `page` se aplica DESPUÉS del merge (slice de PAGE_SIZE sobre el pool global).
 * - `totalPages` = ceil(total_merged / PAGE_SIZE), capado a lo overfetched
 *   (E79 sigue abierto: no recomputamos profundidad real, igual que el resto).
 * - fetchErrorKind agregado (parcial-ok):
 *     · ≥1 familia con items            → null
 *     · 0 items y alguna rate-limit      → "rate-limit"
 *     · 0 items, sin rate-limit          → "generic"
 *   Una familia que rechaza (allSettled rejected) o devuelve vacío NO rompe el
 *   agregado.
 */
export async function fetchAggregateData(
  page: number,
  filters: DiscoverFilters = {}
): Promise<DiscoverResult> {
  const sortKey = resolveSortKey(filters.sort);

  // Cada familia siempre pide su página 1 (overfetch): el merge + slice global
  // decide qué entra en la página solicitada del agregado.
  const settled = await Promise.allSettled(
    FAMILIES.map((type) => fetchDiscoverData(type, 1, filters))
  );

  const lists: MediaItem[][] = [];
  let anyItems = false;
  let anyRateLimit = false;

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      // Familia rechazada: no debería ocurrir (fetchDiscoverData captura), pero
      // si pasa no rompe el agregado.
      continue;
    }
    const { items, fetchErrorKind } = result.value;
    lists.push(items);
    if (items.length > 0) anyItems = true;
    if (fetchErrorKind === "rate-limit") anyRateLimit = true;
  }

  const merged = mergeBySort(lists, sortKey);

  const start = (page - 1) * PAGE_SIZE;
  const items = merged.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(Math.ceil(merged.length / PAGE_SIZE), 1);

  let fetchErrorKind: FetchErrorKind = null;
  if (!anyItems) {
    fetchErrorKind = anyRateLimit ? "rate-limit" : "generic";
  }

  return { items, totalPages, fetchErrorKind };
}
