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
import {
  DISCOVER_MAX_PAGES,
  PAGE_SIZE as DISCOVER_PAGE_SIZE,
} from "@/lib/api/pagination";
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

/** Tamaño de página del agregado (= el de cada familia, fuente: pagination.ts). */
export const PAGE_SIZE = DISCOVER_PAGE_SIZE;

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
 * Páginas globales que sirve UNA ronda de fetch (E79-s3).
 *
 * Una ronda = la misma página nativa pedida a las 7 familias → hasta
 * 7 × 20 = 140 ítems, es decir 7 páginas de PAGE_SIZE en el caso ideal.
 *
 * Se sirven solo 4, NO 7, y es deliberado: el pool real casi nunca llega a 140
 * (una familia puede devolver menos de 20, fallar, o quedar recortada por los
 * post-filtros de su rama — NSFW, temporadas, volúmenes, suite de game…). Con 7
 * páginas por ronda, las últimas 1-2 de CADA ronda saldrían cortas o vacías con
 * "siguiente" activo, que es peor UX que la incoherencia que E79-s3 arregla.
 * Con 4 (80 ítems de un pool típico de 100-140) toda página dentro de la ronda
 * va llena, a cambio de descartar la cola de la ronda (20-60 ítems) — el mismo
 * tipo de descarte que ya hacía el agregado anterior (tiraba 120 de 140), pero
 * mucho menor y ahora CON profundidad real. Eliminar ese descarte requiere
 * cursor/caché de pool → E79-s4.
 */
export const PAGES_PER_ROUND = 4;

/** Página global → ronda (= página nativa que se pide a cada familia). */
export function roundForPage(page: number): number {
  return Math.floor((Math.max(1, page) - 1) / PAGES_PER_ROUND) + 1;
}

/** Página global → offset dentro del pool de su ronda. */
export function offsetInRound(page: number): number {
  return ((Math.max(1, page) - 1) % PAGES_PER_ROUND) * PAGE_SIZE;
}

/**
 * Modo "all": resuelve las 7 familias en paralelo y combina sus resultados.
 *
 * E79-s3 — **profundidad real**. Antes este agregado pedía SIEMPRE `page=1` a
 * cada familia, así que el pool máximo era 7×20 = 140 ítems y "todos" se
 * quedaba en ~5-7 páginas navegables mientras "películas" ofrecía cientos: esa
 * es la incoherencia que reportó el usuario. Ahora la página global se traduce
 * a una RONDA: la página global P pide la página nativa `roundForPage(P)` a
 * cada familia y sirve la porción `offsetInRound(P)` del pool combinado, de
 * modo que cada ronda aprovecha sus ~140 ítems en 7 páginas globales en vez de
 * tirar 120. Es un esquema SIN estado (recomputable en cada petición, sin
 * cursor ni caché) y por eso deliberadamente aproximado — ver E79-s4.
 *
 * - `totalPages`:
 *     · si alguna familia tiene más páginas (`hasMore`) → `null` (no se puede
 *       conocer el total sin recorrerlo; la UI pinta ventana abierta, patrón
 *       E79-s2) — siempre acotado por `DISCOVER_MAX_PAGES`.
 *     · si el pool se agotó → número exacto: páginas de rondas anteriores + las
 *       que llena esta ronda.
 * - `hasMore`: quedan ítems en el pool de esta ronda, o alguna familia tiene
 *   más páginas nativas (hay ronda siguiente), siempre dentro del tope común.
 * - fetchErrorKind agregado (parcial-ok):
 *     · ≥1 familia con items            → null
 *     · 0 items y alguna rate-limit      → "rate-limit"
 *     · 0 items, sin rate-limit          → "generic"
 *   Una familia que rechaza (allSettled rejected) o devuelve vacío NO rompe el
 *   agregado.
 */
export async function fetchAggregateData(
  page: number,
  filters: DiscoverFilters = {},
  locale?: string | null
): Promise<DiscoverResult> {
  // E79-s3: el tope común se aplica a la página GLOBAL. El guard de
  // `fetchDiscoverData` mira la página NATIVA (la de la ronda, mucho más baja),
  // así que sin esto el agregado seguiría sirviendo contenido más allá del tope
  // que la UI anuncia, a diferencia de las familias individuales.
  if (page > DISCOVER_MAX_PAGES) {
    return {
      items: [],
      totalPages: DISCOVER_MAX_PAGES,
      hasMore: false,
      fetchErrorKind: null,
    };
  }

  const sortKey = resolveSortKey(filters.sort);
  const round = roundForPage(page);

  // Ronda = misma página nativa a las 7 familias. `fetchDiscoverData` ya capa
  // cada familia a DISCOVER_MAX_PAGES y devuelve vacío (sin error) si la ronda
  // supera su profundidad, así que una familia corta no rompe el agregado.
  const settled = await Promise.allSettled(
    FAMILIES.map((type) => fetchDiscoverData(type, round, filters, locale))
  );

  const lists: MediaItem[][] = [];
  let anyItems = false;
  let anyRateLimit = false;
  let anyFamilyHasMore = false;

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      // Familia rechazada: no debería ocurrir (fetchDiscoverData captura), pero
      // si pasa no rompe el agregado.
      continue;
    }
    const { items, fetchErrorKind, hasMore } = result.value;
    lists.push(items);
    if (items.length > 0) anyItems = true;
    if (fetchErrorKind === "rate-limit") anyRateLimit = true;
    if (hasMore) anyFamilyHasMore = true;
  }

  const merged = mergeBySort(lists, sortKey);

  const start = offsetInRound(page);
  const items = merged.slice(start, start + PAGE_SIZE);

  // Páginas que ya quedaron atrás en rondas anteriores + las que llena ésta.
  // `pagesThisRound` se acota a PAGES_PER_ROUND: más allá de la ventana de la
  // ronda, `offsetInRound` ya mapearía a la ronda siguiente, así que anunciar
  // esas páginas aquí daría un total que no se corresponde con lo que se sirve.
  const pagesBefore = (round - 1) * PAGES_PER_ROUND;
  const pagesThisRound = Math.min(
    Math.ceil(merged.length / PAGE_SIZE),
    PAGES_PER_ROUND
  );

  // ¿Queda contenido servible DENTRO de la ventana de esta ronda?
  const poolHasMore =
    start + PAGE_SIZE < merged.length &&
    offsetInRound(page + 1) > start; // la página siguiente sigue en esta ronda
  const nextRoundExists = anyFamilyHasMore && round * PAGES_PER_ROUND < DISCOVER_MAX_PAGES;
  const hasMore = (poolHasMore || nextRoundExists) && page < DISCOVER_MAX_PAGES;

  // Total exacto solo cuando no hay más rondas; si las hay, `null` (ventana
  // abierta en la UI) en vez de un número que mentiría por defecto.
  const totalPages: number | null = anyFamilyHasMore
    ? null
    : Math.min(Math.max(pagesBefore + pagesThisRound, 1), DISCOVER_MAX_PAGES);

  let fetchErrorKind: FetchErrorKind = null;
  if (!anyItems) {
    fetchErrorKind = anyRateLimit ? "rate-limit" : "generic";
  }

  return { items, totalPages, hasMore, fetchErrorKind };
}
