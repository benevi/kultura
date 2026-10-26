// ============================================================
// KULTURA — Catálogo de Descubrir: una página de una familia o del agregado
//
// Cada familia vive en su adaptador (`families/*`, misma interfaz). Aquí solo
// se elige el adaptador y se aplica lo común: tope de páginas, modo búsqueda,
// filtro NSFW, total no fiable con post-filtro y presentación de errores.
// ============================================================

import { createLogger } from "@/lib/logger";
import { COMIC_CATALOG_MAX_PAGES } from "@/lib/api/families/comic";
import { describeError, isRateLimitError } from "@/lib/api/families/errors";
import { familyAdapter, type DiscoverFilters } from "@/lib/api/families";
import type { MediaItem, MediaType } from "@/types/media";
// Ciclo discover↔aggregate: se resuelve en runtime porque ninguno se invoca
// al cargar el módulo.
import { fetchAggregateData, fetchAggregateSearch } from "@/lib/api/aggregate";
import { searchByTypePaged } from "@/lib/api/search";
import { filterNSFW } from "@/lib/api/nsfw-filter";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";

export type { DiscoverFilters } from "@/lib/api/families";

const log = createLogger("discover");

export type FetchErrorKind = "rate-limit" | "generic" | null;

export interface DiscoverResult {
  items: MediaItem[];
  /**
   * E79-s2 — `null` = total NO fiable: la familia tiene un post-filtro ACTIVO
   * que recorta ítems después del fetch sin recomputar el conteo del
   * proveedor. La UI omite entonces la "última página [N]". `number | null`
   * en vez de un booleano paralelo: así es imposible leer un N obsoleto.
   */
  totalPages: number | null;
  /**
   * E79-s1 — ¿la FUENTE cruda tiene más páginas tras la actual? Se computa
   * contra el total del proveedor (antes de los post-filtros), y es lo que
   * gobierna el botón "siguiente".
   */
  hasMore: boolean;
  fetchErrorKind: FetchErrorKind;
}

/**
 * Techo de páginas de una familia: el común salvo el CATÁLOGO de cómic, que
 * tiene el suyo (E-COMIC-PROFUNDIDAD). En búsqueda (`isSearch`) el cómic usa
 * la zancada normal y vuelve al techo común.
 */
export function maxPagesForType(type: string, isSearch = false): number {
  return type === "comic" && !isSearch ? COMIC_CATALOG_MAX_PAGES : DISCOVER_MAX_PAGES;
}

const failed = (e: unknown): DiscoverResult => ({
  items: [],
  totalPages: 1,
  hasMore: false,
  fetchErrorKind: isRateLimitError(e) ? "rate-limit" : "generic",
});

/**
 * Resuelve una página de catálogo para una familia (o el agregado `all`).
 * Nunca lanza: un fallo de proveedor sale como `fetchErrorKind`.
 *
 * `locale`: idioma activo, para los proveedores que lo soportan (TMDB, Open
 * Library, MangaDex; ver `locale.ts`). Omitirlo equivale a `es`.
 *
 * `query` (E-DISCOVER-SEARCH-MERGE): la página sale del BUSCADOR del
 * proveedor con la misma forma de respuesta. Los filtros de catálogo no se
 * aplican: ningún buscador los acepta (la UI oculta la barra de filtros).
 */
export async function fetchDiscoverData(
  type: string,
  page: number,
  filters: DiscoverFilters = {},
  locale?: string | null,
  query?: string | null
): Promise<DiscoverResult> {
  // E79-s3: fuera del tope → página vacía SIN llamar a nadie y SIN banner de
  // error (distinto de un fallo de red real).
  const maxPages = maxPagesForType(type, Boolean(query));
  if (page > maxPages) {
    return { items: [], totalPages: maxPages, hasMore: false, fetchErrorKind: null };
  }

  if (query) {
    try {
      const res =
        type === "all"
          ? await fetchAggregateSearch(query, page, locale)
          : await searchByTypePaged(query, type as MediaType, page, locale);
      return {
        items: filterNSFW(res.items),
        totalPages: res.totalPages === null ? null : Math.min(res.totalPages, DISCOVER_MAX_PAGES),
        hasMore: res.hasMore && page < DISCOVER_MAX_PAGES,
        fetchErrorKind: null,
      };
    } catch (e) {
      console.error(`[discover] search error · type=${type} page=${page} · ${describeError(e)}`);
      return failed(e);
    }
  }

  // Agregado E59 R5a: fan-out a las 7 familias; devuelve su propio resultado.
  if (type === "all") return fetchAggregateData(page, filters, locale);

  const adapter = familyAdapter(type);
  try {
    const res = await adapter.discover(page, filters, locale);
    // E86: post-filtro NSFW global, último paso; complementa los filtros
    // nativos (include_adult, sfw, exclude_tags) con lo que se les escapa.
    return {
      items: filterNSFW(res.items),
      totalPages: adapter.hasActivePostFilter(filters) ? null : res.totalPages,
      hasMore: res.hasMore,
      fetchErrorKind: null,
    };
  } catch (e) {
    // El diagnóstico va DENTRO del mensaje: en el visor de Vercel `context`
    // sale colapsado y se lee la lista, no cada línea.
    log.error(`API error · type=${type} page=${page} · ${describeError(e)}`, { type, page, err: e });
    return failed(e);
  }
}
