// ============================================================
// KULTURA — Página del título en el proveedor que sirve sus datos
//
// La ficha cita su fuente con un enlace activo a la página del título en ese
// proveedor. RAWG lo exige en cada página que use sus datos (VERIF-C, términos
// de rawg.io/apidocs); para el resto es lo honesto y da a quien llega desde un
// buscador una vía a la fuente original. Función pura: se decide por la forma
// del id, la misma que enruta la ficha (`media-id.ts`).
// ============================================================

import type { MediaType } from "@/types/media";

export interface SourceLink {
  /** Nombre de la marca tal cual (no se traduce). */
  name: string;
  url: string;
}

const ANILIST_REF = /^al-(\d{1,10})$/;
const TMDB_ANIME_REF = /^tmdb-(\d{1,10})$/;
const NUMERIC = /^\d{1,10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_LIBRARY = /^OL\d{1,12}([WM])$/;
const RAWG_SLUG = /^[a-z0-9][a-z0-9-]{0,150}$/;

/**
 * `extra.rawgSlug`: RAWG publica sus juegos en `rawg.io/games/{slug}`; sin
 * slug se usa el id, que RAWG también resuelve.
 */
export function sourceLinkFor(
  type: MediaType,
  externalId: string,
  extra: { rawgSlug?: string } = {}
): SourceLink | null {
  switch (type) {
    case "movie":
    case "tv":
      return NUMERIC.test(externalId)
        ? { name: "TMDB", url: `https://www.themoviedb.org/${type}/${externalId}` }
        : null;
    case "anime": {
      const al = ANILIST_REF.exec(externalId);
      if (al) return { name: "AniList", url: `https://anilist.co/anime/${al[1]}` };
      const tmdb = TMDB_ANIME_REF.exec(externalId);
      if (tmdb) return { name: "TMDB", url: `https://www.themoviedb.org/tv/${tmdb[1]}` };
      return NUMERIC.test(externalId)
        ? { name: "MyAnimeList", url: `https://myanimelist.net/anime/${externalId}` }
        : null;
    }
    case "manga": {
      if (UUID.test(externalId)) {
        return { name: "MangaDex", url: `https://mangadex.org/title/${externalId.toLowerCase()}` };
      }
      const al = ANILIST_REF.exec(externalId);
      if (al) return { name: "AniList", url: `https://anilist.co/manga/${al[1]}` };
      return NUMERIC.test(externalId)
        ? { name: "MyAnimeList", url: `https://myanimelist.net/manga/${externalId}` }
        : null;
    }
    case "book": {
      const ol = OPEN_LIBRARY.exec(externalId);
      if (ol) {
        const kind = ol[1] === "W" ? "works" : "books";
        return { name: "Open Library", url: `https://openlibrary.org/${kind}/${externalId}` };
      }
      return /^[A-Za-z0-9_-]{6,24}$/.test(externalId)
        ? { name: "Google Books", url: `https://books.google.com/books?id=${externalId}` }
        : null;
    }
    case "game": {
      if (!NUMERIC.test(externalId)) return null;
      const slug = extra.rawgSlug && RAWG_SLUG.test(extra.rawgSlug) ? extra.rawgSlug : externalId;
      return { name: "RAWG", url: `https://rawg.io/games/${slug}` };
    }
    case "comic":
      return NUMERIC.test(externalId)
        ? { name: "Comic Vine", url: `https://comicvine.gamespot.com/issue/4000-${externalId}/` }
        : null;
    default:
      return null;
  }
}
