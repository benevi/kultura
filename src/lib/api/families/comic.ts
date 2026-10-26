// KULTURA — Catálogo de cómic (ComicVine /issues + /volumes).

import { getRecentComics, COMIC_PAGE_STRIDE, COMIC_MAX_PAGES } from "@/lib/api/comicvine";
import { hasComicFilters } from "@/lib/api/comicvine-maps";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";
import { pageOf, pagesFromCount, type FamilyAdapter } from "./types";

/**
 * E-COMIC-PROFUNDIDAD: la página N lee el offset `(N-1) × COMIC_PAGE_STRIDE`
 * del proveedor, así que el tope común la mandaba al fondo del catálogo, donde
 * ya no queda nada que la lista blanca acepte. Solo vale para el catálogo: en
 * el buscador la zancada es la normal.
 */
export const COMIC_CATALOG_MAX_PAGES = Math.min(COMIC_MAX_PAGES, DISCOVER_MAX_PAGES);

export const comicFamily: FamilyAdapter = {
  maxPages: COMIC_CATALOG_MAX_PAGES,
  async discover(page, filters) {
    // Con filtros (sort/year/editorial) → filtrado; sin filtros, la llamada de
    // siempre. `genre` sigue oculto para el cómic.
    const res = hasComicFilters(filters) ? await getRecentComics(page, filters) : await getRecentComics(page);
    // E-COMIC-VENTANA: se divide por lo que cada página CONSUME del proveedor
    // (300 issues), no por lo que enseña (20).
    return pageOf(res.items, page, pagesFromCount(res.total, COMIC_PAGE_STRIDE), COMIC_CATALOG_MAX_PAGES);
  },
  // Editorial y volúmenes se filtran sobre el volumen resuelto tras /issues:
  // el `total` de ComicVine nunca refleja ese recorte.
  hasActivePostFilter: (filters) => Boolean(filters.editorial?.length || filters.volumenes),
};
