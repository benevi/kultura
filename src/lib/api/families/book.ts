// KULTURA — Catálogo de libros (Open Library).
//
// E-BOOKS-HIBRIDO: el CATÁLOGO lo sirve Open Library: el idioma es un facet
// real, el año un rango real y `numFound` un total real. La ficha se sigue
// enriqueciendo con Google Books. Sin post-filtro: el año viaja en la
// consulta, así que el conteo es fiable y se ofrece la última página.

import { dropFutureYears } from "@/lib/api/catalog-window";
import {
  searchOpenLibrary,
  openLibraryTotalPages,
  OPEN_LIBRARY_CATALOG_WINDOW,
  OPEN_LIBRARY_WINDOWS_PER_PAGE,
  OPEN_LIBRARY_PAGE_STRIDE,
  OPEN_LIBRARY_PAGE_SIZE,
} from "@/lib/api/openlibrary";
import {
  buildOpenLibraryQuery,
  openLibraryTrimsFutureAfterFetch,
} from "@/lib/api/openlibrary-maps";
import { normalizeBookOpenLibrary } from "@/lib/api/normalizer";
import type { MediaItem } from "@/types/media";
import { noPostFilter, pageOf, type FamilyAdapter } from "./types";

export const bookFamily: FamilyAdapter = {
  async discover(page, filters, locale) {
    const { q, params } = buildOpenLibraryQuery(filters, locale);
    // E-BOOKS-VENTANA / E-BOOKS-PAGINA-FIJA: cada petición pide una ventana más
    // ancha de lo que se enseña (se descartan los libros sin portada y ese
    // recorte no es uniforme), y una página mira hasta
    // OPEN_LIBRARY_WINDOWS_PER_PAGE ventanas y para en cuanto junta
    // OPEN_LIBRARY_PAGE_SIZE. Mismo patrón que el cómic.
    const baseWindow = (page - 1) * OPEN_LIBRARY_WINDOWS_PER_PAGE;
    const collected: MediaItem[] = [];
    let numFound: number | undefined;

    for (let w = 0; w < OPEN_LIBRARY_WINDOWS_PER_PAGE; w++) {
      const res = await searchOpenLibrary(q, baseWindow + w + 1, params, OPEN_LIBRARY_CATALOG_WINDOW);
      numFound = res.numFound ?? numFound;
      const docs = res.docs ?? [];
      // E-BOOKS-PORTADA: fuera los libros sin portada (en un catálogo visual
      // una card sin imagen es un hueco). No se aplica al buscador ni a la ficha.
      let batch = docs.filter((doc) => Boolean(doc.cover_i)).map((doc) => normalizeBookOpenLibrary(doc));
      // E-BOOKS-RANGO: sin filtro de año la consulta NO lleva rango (uno que
      // abarca el corpus entero hace que Open Library cierre la conexión), así
      // que el tope de años futuros se aplica aquí, como en manga.
      if (openLibraryTrimsFutureAfterFetch(filters.year)) batch = dropFutureYears(batch);
      collected.push(...batch);
      // Suficiente para llenar la página, o el proveedor ya no da más.
      if (collected.length >= OPEN_LIBRARY_PAGE_SIZE || docs.length < OPEN_LIBRARY_CATALOG_WINDOW) break;
    }

    // El total se divide por lo que la página CONSUME (la zancada), no por lo
    // que enseña: así no se ofrecen páginas que ya se han recorrido.
    return pageOf(
      collected.slice(0, OPEN_LIBRARY_PAGE_SIZE),
      page,
      openLibraryTotalPages(numFound, OPEN_LIBRARY_PAGE_STRIDE)
    );
  },
  hasActivePostFilter: noPostFilter,
};
