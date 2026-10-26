// KULTURA — Catálogo de cine (TMDB /discover/movie). También es el respaldo
// para un `type` desconocido.

import { discoverMovies } from "@/lib/api/tmdb";
import { buildTmdbDiscoverParams } from "@/lib/api/tmdb-maps";
import { normalizeMovie } from "@/lib/api/normalizer";
import { noPostFilter, pageOf, type FamilyAdapter } from "./types";

export const movieFamily: FamilyAdapter = {
  async discover(page, filters, locale) {
    const res = await discoverMovies(page, buildTmdbDiscoverParams("movie", filters), locale);
    // E79-s3: tope COMÚN de páginas; `hasMore` se gobierna contra el tope.
    return pageOf(res.results.map((m) => normalizeMovie(m)), page, res.total_pages);
  },
  hasActivePostFilter: noPostFilter,
};
