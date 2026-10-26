// KULTURA — Catálogo de series (TMDB /discover/tv).

import { discoverTV } from "@/lib/api/tmdb";
import { buildTmdbDiscoverParams, filterTVByTemporadas } from "@/lib/api/tmdb-maps";
import { normalizeTV } from "@/lib/api/normalizer";
import { pageOf, type FamilyAdapter } from "./types";

export const tvFamily: FamilyAdapter = {
  async discover(page, filters, locale) {
    const res = await discoverTV(page, buildTmdbDiscoverParams("tv", filters), locale);
    // POST-filtro temporadas (R4c-2): bucket sobre metadata.seasons. No entra
    // en el builder, así que no cambia el fetch. Vacío → no filtra.
    const items = filterTVByTemporadas(res.results.map((tv) => normalizeTV(tv)), filters.temporadas);
    return pageOf(items, page, res.total_pages);
  },
  hasActivePostFilter: (filters) => Boolean(filters.temporadas),
};
