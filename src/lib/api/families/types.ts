// ============================================================
// KULTURA — Contrato de los adaptadores de catálogo por familia (COD-10)
//
// Cada familia (cine, series, anime, manga, libros, cómic, juegos) resuelve
// UNA página de su catálogo con la misma interfaz. `discover.ts` solo elige
// el adaptador y aplica lo común (tope de páginas, búsqueda, NSFW, errores).
// ============================================================

import type { TmdbFilters } from "@/lib/api/tmdb-maps";
import type { AniListFilters } from "@/lib/api/anilist-maps";
import type { MangaDexFilters } from "@/lib/api/mangadex-maps";
import type { RawgFilters } from "@/lib/api/rawg-maps";
import type { OpenLibraryBookFilters } from "@/lib/api/openlibrary-maps";
import type { ComicFilters } from "@/lib/api/comicvine-maps";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";
import type { MediaItem } from "@/types/media";

/**
 * Filtros canónicos aplicables a la capa de fetch. Unión de los subconjuntos que
 * cada familia consume nativamente. Cada builder toma solo los campos que
 * entiende; el resto los ignora.
 */
export type DiscoverFilters = TmdbFilters &
  AniListFilters &
  MangaDexFilters &
  RawgFilters &
  OpenLibraryBookFilters &
  ComicFilters;

/** Una página de una familia, antes del filtro NSFW común. */
export interface FamilyPage {
  items: MediaItem[];
  /** Páginas del proveedor, ya acotadas al techo de la familia. */
  totalPages: number;
  /** ¿La fuente cruda tiene más páginas tras la actual? (E79-s1) */
  hasMore: boolean;
}

export interface FamilyAdapter {
  /** Techo de páginas del catálogo (por defecto `DISCOVER_MAX_PAGES`). */
  maxPages?: number;
  /** Resuelve la página `page` (1-based). Lanza si el proveedor falla. */
  discover(
    page: number,
    filters: DiscoverFilters,
    locale?: string | null
  ): Promise<FamilyPage>;
  /**
   * E79-s2 — ¿hay un post-filtro ACTIVO que recorte ítems tras el fetch sin
   * recomputar el conteo del proveedor? Si lo hay, el total crudo miente y la
   * capa devuelve `totalPages: null`. Solo cuenta el post-filtro de la familia
   * con VALOR; el NSFW global (siempre activo, recorte marginal) no.
   */
  hasActivePostFilter(filters: DiscoverFilters): boolean;
}

/**
 * Página con el total acotado al techo y `hasMore` contra ese total: la última
 * página no ofrece "siguiente" aunque el total crudo del proveedor sea mayor.
 */
export function pageOf(
  items: MediaItem[],
  page: number,
  providerPages: number,
  cap: number = DISCOVER_MAX_PAGES
): FamilyPage {
  const totalPages = Math.min(providerPages, cap);
  return { items, totalPages, hasMore: page < totalPages };
}

/** Páginas de un total de ítems con una zancada dada (mínimo 1). */
export function pagesFromCount(count: number | undefined, stride: number): number {
  return Math.max(Math.ceil((count ?? 0) / stride), 1);
}

export const noPostFilter = (): boolean => false;
