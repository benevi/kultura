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
import type { MediaItem, MediaType } from "@/types/media";
import { searchByTypePaged, type SearchPage } from "@/lib/api/search";
import { mergeByRelevance } from "@/lib/api/search-rank";
import { filterNSFW } from "@/lib/api/nsfw-filter";
import { isProviderQuotaHot } from "@/lib/api/http";

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

type Family = (typeof FAMILIES)[number];

/**
 * Familias que entran en esta petición. D-17: si ComicVine pasa del 80 % de
 * su cupo horario en el recurso que se va a usar (`issues` en el catálogo,
 * `search` en la búsqueda), el cómic sale de `type=all` hasta la hora
 * siguiente; quien entra en la pestaña Cómics lo sigue teniendo. Así el
 * agregado, que hace siete llamadas por petición, no agota el cupo de todos.
 */
export function activeFamilies(mode: "catalog" | "search"): Family[] {
  const resource = mode === "search" ? "search" : "issues";
  return isProviderQuotaHot("comicvine", resource)
    ? FAMILIES.filter((f) => f !== "comic")
    : [...FAMILIES];
}

/**
 * Resultado del agregado con el aviso de respuesta PARCIAL: alguna familia
 * falló (rechazo o error del proveedor). La ruta no cachea en el borde una
 * respuesta parcial: con RAWG caído, "todos" saldría sin juegos una hora para
 * todo el mundo.
 */
export interface AggregateResult extends DiscoverResult {
  partial: boolean;
}

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

/** Búsqueda agregada con el detalle de qué familias fallaron. */
export interface AggregateSearchPage extends SearchPage {
  /** Alguna familia falló: la página no tiene todo lo que debería. */
  partial: boolean;
  /** TODAS las familias fallaron (la página vacía no es "sin resultados"). */
  allFailed: boolean;
  /** Alguna familia falló por cupo o límite del proveedor (429). */
  rateLimited: boolean;
}

function isRateLimited(reason: unknown): boolean {
  return (reason as { status?: unknown } | null)?.status === 429;
}

/**
 * Modo "all" + BÚSQUEDA de texto (E-DISCOVER-SEARCH-MERGE).
 *
 * Mismo esquema de rondas que `fetchAggregateData`, pero la fuente de cada
 * familia es su BUSCADOR (`searchByTypePaged`) en vez del catálogo.
 *
 * F-13 (DAT-9): las familias se mezclan por RELEVANCIA (`mergeByRelevance`)
 * y no por turnos: antes el primer cómic de "dune" pesaba lo mismo que la
 * película "Dune". A igualdad de coincidencia se mantiene el orden por turnos.
 */
export async function fetchAggregateSearch(
  query: string,
  page: number,
  locale?: string | null
): Promise<AggregateSearchPage> {
  if (page > DISCOVER_MAX_PAGES) {
    return {
      items: [],
      totalPages: DISCOVER_MAX_PAGES,
      hasMore: false,
      partial: false,
      allFailed: false,
      rateLimited: false,
    };
  }

  const round = roundForPage(page);
  const families = activeFamilies("search");
  const settled = await Promise.allSettled(
    families.map((type) =>
      // Sin complemento de MyAnimeList: en "todos" esperaría en serie hasta
      // 2,5 s por una obra que casi siempre es de otra familia.
      searchByTypePaged(query, type as MediaType, round, locale, { supplement: false })
    )
  );

  const lists: MediaItem[][] = [];
  let anyFamilyHasMore = false;
  let failed = 0;
  let rateLimited = false;
  for (const result of settled) {
    // Una familia que falla (sin key, rate-limit, red) no rompe la búsqueda
    // agregada: no aporta resultados y la respuesta queda marcada parcial.
    if (result.status !== "fulfilled") {
      failed++;
      if (isRateLimited(result.reason)) rateLimited = true;
      continue;
    }
    lists.push(result.value.items);
    if (result.value.hasMore) anyFamilyHasMore = true;
  }

  const merged = mergeByRelevance(query, lists);
  const start = offsetInRound(page);
  const items = merged.slice(start, start + PAGE_SIZE);

  const poolHasMore =
    start + PAGE_SIZE < merged.length && offsetInRound(page + 1) > start;
  const nextRoundExists =
    anyFamilyHasMore && round * PAGES_PER_ROUND < DISCOVER_MAX_PAGES;

  return {
    items,
    totalPages: anyFamilyHasMore
      ? null
      : Math.min(
          Math.max(
            (round - 1) * PAGES_PER_ROUND +
              Math.min(Math.ceil(merged.length / PAGE_SIZE), PAGES_PER_ROUND),
            1
          ),
          DISCOVER_MAX_PAGES
        ),
    hasMore: (poolHasMore || nextRoundExists) && page < DISCOVER_MAX_PAGES,
    partial: failed > 0,
    allFailed: failed === settled.length,
    rateLimited,
  };
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
): Promise<AggregateResult> {
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
      partial: false,
    };
  }

  const sortKey = resolveSortKey(filters.sort);
  const round = roundForPage(page);

  // Ronda = misma página nativa a las 7 familias. `fetchDiscoverData` ya capa
  // cada familia a DISCOVER_MAX_PAGES y devuelve vacío (sin error) si la ronda
  // supera su profundidad, así que una familia corta no rompe el agregado.
  const settled = await Promise.allSettled(
    activeFamilies("catalog").map((type) =>
      fetchDiscoverData(type, round, filters, locale)
    )
  );

  const lists: MediaItem[][] = [];
  let anyItems = false;
  let anyRateLimit = false;
  let anyFamilyHasMore = false;
  // F-13: una familia que falla (rechazo o `fetchErrorKind`) deja la página
  // coja; la ruta lo necesita saber para no cachearla en el borde.
  let partial = false;

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      // Familia rechazada: no debería ocurrir (fetchDiscoverData captura), pero
      // si pasa no rompe el agregado.
      partial = true;
      continue;
    }
    const { items, fetchErrorKind, hasMore } = result.value;
    if (fetchErrorKind) partial = true;
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

  return { items, totalPages, hasMore, fetchErrorKind, partial };
}

/**
 * Punto de entrada de la ruta para `type=all` (catálogo o búsqueda) con el
 * aviso de parcial. En búsqueda aplica lo mismo que `fetchDiscoverData`: el
 * filtro NSFW, el tope común de páginas y un `fetchErrorKind` si no respondió
 * ninguna familia (antes salía una rejilla vacía como "sin resultados").
 */
export async function fetchAggregateResult(
  page: number,
  filters: DiscoverFilters = {},
  locale?: string | null,
  query?: string | null
): Promise<AggregateResult> {
  if (!query) return fetchAggregateData(page, filters, locale);
  const res = await fetchAggregateSearch(query, page, locale);
  return {
    items: filterNSFW(res.items),
    totalPages:
      res.totalPages === null ? null : Math.min(res.totalPages, DISCOVER_MAX_PAGES),
    hasMore: res.hasMore && page < DISCOVER_MAX_PAGES,
    fetchErrorKind: res.allFailed ? (res.rateLimited ? "rate-limit" : "generic") : null,
    partial: res.partial,
  };
}
