// KULTURA — Catálogo de anime (AniList, con respaldo en TMDB).
//
// E-ANIME-SOURCE (2026-09-13): AniList reemplaza a Jikan/MAL, que sufría 504
// sostenidos en producción. AniList pagina por page/perPage nativo.

import { discoverAnime } from "@/lib/api/anilist";
import { discoverAnimeTmdb } from "@/lib/api/anime-tmdb";
import { buildAniListDiscoverParams } from "@/lib/api/anilist-maps";
import { normalizeAniListAnime } from "@/lib/api/normalizer";
import { noPostFilter, pageOf, type FamilyAdapter } from "./types";

export const animeFamily: FamilyAdapter = {
  async discover(page, filters, locale) {
    let res: Awaited<ReturnType<typeof discoverAnime>>;
    try {
      res = await discoverAnime(page, buildAniListDiscoverParams(filters));
    } catch (e) {
      // E-ANIME-RESPALDO: si AniList cae, el anime sale de TMDB. Si el respaldo
      // tampoco da nada, se propaga el error ORIGINAL (así un 429 de AniList se
      // sigue presentando como rate-limit).
      const alt = await discoverAnimeTmdb(page, filters, locale).catch(() => null);
      if (!alt || alt.items.length === 0) throw e;
      return pageOf(alt.items, page, alt.totalPages);
    }
    const data = Array.isArray(res.media) ? res.media : [];
    return pageOf(data.map((a) => normalizeAniListAnime(a)), page, res.pageInfo?.lastPage ?? 1);
  },
  hasActivePostFilter: noPostFilter,
};
