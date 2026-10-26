// KULTURA — Catálogo de juegos (RAWG).

import { getPopularGames, discoverGames } from "@/lib/api/rawg";
import { buildRawgDiscoverParams, applyGamePostFilters } from "@/lib/api/rawg-maps";
import { normalizeGame } from "@/lib/api/normalizer";
import { pageOf, pagesFromCount, type FamilyAdapter } from "./types";

export const gameFamily: FamilyAdapter = {
  async discover(page, filters) {
    // Con filtros nativos → /games filtrado; sin filtros, getPopularGames
    // (ordering=-rating) por paridad con F2.
    const native = Boolean(filters.genre?.length || filters.platform?.length || filters.year || filters.sort);
    const res = native ? await discoverGames(page, buildRawgDiscoverParams(filters)) : await getPopularGames(page);
    // POST-filtros (R4c-1): metacritic, estado, modo de juego y duración. No
    // cambian el fetch; se aplican tras normalizar.
    const items = applyGamePostFilters(res.results.map((g) => normalizeGame(g)), filters);
    // E79-s3: sin tope, RAWG count=900360 daba 45018 páginas fantasma.
    return pageOf(items, page, pagesFromCount(res.count, 20));
  },
  hasActivePostFilter: (filters) =>
    Boolean(filters.valoracion || filters.estado || filters.modojuego?.length || filters.duracionmedia),
};
