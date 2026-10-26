// KULTURA — Catálogo de manga (MangaDex).
//
// E-MANGA-SOURCE: MangaDex (no Jikan), el único proveedor con catálogo
// realmente traducido. Pagina por offset/limit, no por página.

import { dropFutureYears } from "@/lib/api/catalog-window";
import { getPopularManga, discoverManga } from "@/lib/api/mangadex";
import {
  buildMangaDexDiscoverParams,
  hasMangaDexFilters,
  filterByMinVolumesDex,
} from "@/lib/api/mangadex-maps";
import { normalizeMangaDex } from "@/lib/api/normalizer";
import { pageOf, pagesFromCount, type FamilyAdapter } from "./types";

const MANGA_PAGE_SIZE = 20;

export const mangaFamily: FamilyAdapter = {
  async discover(page, filters, locale) {
    const offset = (page - 1) * MANGA_PAGE_SIZE;
    const res = hasMangaDexFilters(filters)
      ? await discoverManga(offset, buildMangaDexDiscoverParams(filters), locale)
      : await getPopularManga(offset, locale);
    // E29: nunca confiar en que `data` llegue como array.
    const data = Array.isArray(res.data) ? res.data : [];
    // E-CATALOGO-FUTURO: MangaDex solo acepta `year` como igualdad exacta, no
    // como rango, así que el tope de años futuros se aplica tras normalizar
    // (recorte marginal e incondicional, como el NSFW: NO cuenta como
    // post-filtro activo). Los manga sin año se conservan.
    let items = dropFutureYears(data.map((m) => normalizeMangaDex(m, locale)));
    // POST-filtro de volúmenes: umbral mínimo sobre metadata.volumes.
    items = filterByMinVolumesDex(items, filters.volumenes);
    return pageOf(items, page, pagesFromCount(res.total, MANGA_PAGE_SIZE));
  },
  hasActivePostFilter: (filters) => Boolean(filters.volumenes),
};
