// ============================================================
// KULTURA — Búsqueda por familia
// Traduce una query de texto a la búsqueda nativa de cada proveedor y devuelve
// resultados ya normalizados a MediaItem, ordenados por relevancia.
//
// E-DISCOVER-SEARCH-MERGE: `searchAll` (que agregaba las 6 familias en una sola
// respuesta con forma `{movies, tv, anime, …}`) se ELIMINÓ al fusionar /search
// dentro de /discover: su único consumidor era la página /search, que ahora es
// un redirect. El agregado de búsqueda vive en `fetchAggregateSearch`
// (aggregate.ts), que reusa `searchByTypePaged` y devuelve la misma forma
// paginada que el resto de Descubrir.
//
// F-13 (DAT-6/7/9):
//   - Relevancia común (`rankSearchResults`): el título que coincide con la
//     consulta va primero en todas las familias y, en `type=all`, entre
//     familias. Antes cada proveedor imponía su orden ("dark" → Dark Shadows,
//     "inception" → "Bikini Inception" en el autocompletado) y `type=all`
//     intercalaba sin comparar.
//   - Cómic por SERIES (ComicVine `/search/` de volúmenes) y no por issues.
//   - Manga por relevancia, sin doujinshi, con nota y con el título oficial.
//   - Respaldo por familia: manga → MyAnimeList (Jikan); cómic → Google Books
//     (novela gráfica). Juegos sin respaldo: la ficha de juego solo abre ids de
//     RAWG (pendiente de la ficha pública, F-15).
// ============================================================

import type { MediaItem, MediaType } from "@/types/media";
import { searchMovies, searchTV } from "./tmdb";
import { searchAnime } from "./anilist";
import { searchAnimeTmdb } from "./anime-tmdb";
import {
  getMangaStatistics,
  isMangaVariant,
  mangaAltTitles,
  mangaDisplayTitle,
  searchManga,
  type MangaDexManga,
  type MangaDexStats,
} from "./mangadex";
import { JIKAN_SUPPLEMENT_TIMEOUT_MS, searchMangaJikan } from "./jikan";
import { searchOpenLibrary, openLibraryTotalPages } from "./openlibrary";
import { searchGames } from "./rawg";
import { COMIC_SEARCH_PAGE_SIZE, searchComicVolumes } from "./comicvine";
import { searchComicsGoogleBooks } from "./googlebooks";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAniListAnime,
  normalizeMangaDex,
  normalizeMangaJikan,
  normalizeBookOpenLibrary,
  normalizeBookGoogle,
  normalizeGame,
} from "./normalizer";
import type { TmdbMovieDetail, TmdbTVDetail } from "./tmdb";
import { isExactTitleMatch, rankSearchResults, titleIdentity } from "./search-rank";

// La relevancia vive en `search-rank.ts` (funciones puras); se re-exporta
// aquí porque es la API pública de la búsqueda.
export {
  isExactTitleMatch,
  isNonLatinTitle,
  MATCH_TIER,
  mergeByRelevance,
  rankSearchResults,
  relevanceScore,
  titleMatchTier,
  titleWords,
} from "./search-rank";

/** Ítems por página (offset-based) de MangaDex — = page-size de Descubrir. */
const MANGADEX_PAGE_SIZE = 20;

// ── Manga (DAT-7) ─────────────────────────────────────────────────────────────

/** MangaDex → MediaItem con título oficial, títulos alternativos y nota. */
export function enrichMangaDexItem(
  raw: MangaDexManga,
  locale: string | null | undefined,
  stats?: MangaDexStats
): MediaItem {
  const base = normalizeMangaDex(raw, locale);
  const { title, original } = mangaDisplayTitle(raw);
  return {
    ...base,
    title: title ?? base.title,
    originalTitle: original ?? base.originalTitle,
    rating: stats?.rating ?? base.rating,
    metadata: {
      ...base.metadata,
      altTitles: mangaAltTitles(raw),
      follows: stats?.follows,
      variant: isMangaVariant(raw) || undefined,
    },
  };
}

/** Clave para no repetir la misma obra que llega por dos proveedores. */
function workKey(item: MediaItem): string {
  return `${titleIdentity(item.title)}|${item.year ?? ""}`;
}

async function searchMangaJikanItems(
  query: string,
  page: number,
  timeoutMs?: number
): Promise<{ items: MediaItem[]; totalPages: number }> {
  const r = await searchMangaJikan(query, page, timeoutMs);
  return {
    items: (r.data ?? []).map((raw) => normalizeMangaJikan(raw)),
    totalPages: Math.max(r.pagination?.last_visible_page ?? 1, 1),
  };
}

/**
 * Búsqueda de manga: MangaDex por relevancia + nota (`/statistics/manga`).
 *   - Si MangaDex falla, MyAnimeList (Jikan) como respaldo.
 *   - Si en la primera página ninguna obra se llama como la consulta (obras
 *     retiradas de MangaDex por licencia: "Berserk", "Vagabond"), se añaden
 *     las coincidencias exactas de MyAnimeList.
 */
async function searchMangaPage(query: string, page: number, locale?: string | null): Promise<SearchPage> {
  let r;
  try {
    r = await searchManga(query, (page - 1) * MANGADEX_PAGE_SIZE, locale);
  } catch (e) {
    const alt = await searchMangaJikanItems(query, page).catch(() => null);
    if (!alt) throw e;
    return {
      items: rankSearchResults(query, alt.items),
      totalPages: alt.totalPages,
      hasMore: page < alt.totalPages,
    };
  }
  const stats = await getMangaStatistics(r.data.map((m) => m.id));
  let items = r.data.map((raw) => enrichMangaDexItem(raw, locale, stats.get(raw.id)));

  if (page === 1 && query.trim().length >= 3 && !items.some((i) => isExactTitleMatch(query, i))) {
    const extra = await searchMangaJikanItems(query, 1, JIKAN_SUPPLEMENT_TIMEOUT_MS).catch(() => null);
    const exact = (extra?.items ?? []).filter((i) => isExactTitleMatch(query, i));
    const seen = new Set(items.map(workKey));
    items = [...exact.filter((i) => !seen.has(workKey(i))), ...items];
  }

  const totalPages = Math.max(Math.ceil((r.total ?? 0) / MANGADEX_PAGE_SIZE), 1);
  return { items: rankSearchResults(query, items), totalPages, hasMore: page < totalPages };
}

// ── Cómic (DAT-6) ─────────────────────────────────────────────────────────────

/**
 * Búsqueda de cómic por SERIE (ComicVine). Si ComicVine no responde, novela
 * gráfica de Google Books (se abre como libro).
 */
async function searchComicPage(query: string, page: number): Promise<SearchPage> {
  try {
    const r = await searchComicVolumes(query, page);
    const totalPages = Math.max(Math.ceil(r.total / COMIC_SEARCH_PAGE_SIZE), 1);
    return { items: rankSearchResults(query, r.items), totalPages, hasMore: page < totalPages };
  } catch (e) {
    const alt = await searchComicsGoogleBooks(query, page).catch(() => null);
    if (!alt) throw e;
    const items = (alt.items ?? []).map((raw) => normalizeBookGoogle(raw));
    const totalPages = Math.max(Math.ceil((alt.totalItems ?? 0) / MANGADEX_PAGE_SIZE), 1);
    return { items: rankSearchResults(query, items), totalPages, hasMore: page < totalPages };
  }
}

/**
 * Busca solo en el tipo de contenido indicado (SIN paginar: primera página),
 * ya ordenado por relevancia. La usa el autocompletado (`/api/search?type=`).
 *
 * `locale`: idioma activo de la app. Se propaga a los proveedores que lo
 * soportan (TMDB, Google Books); Jikan, ComicVine y RAWG lo ignoran (limitación
 * documentada en `lib/api/locale.ts`).
 */
export async function searchByType(
  query: string,
  type: MediaType,
  locale?: string | null
): Promise<MediaItem[]> {
  return (await searchByTypePaged(query, type, 1, locale)).items;
}

// ── Búsqueda PAGINADA por familia (E-DISCOVER-SEARCH-MERGE) ──────────────────

/**
 * Una página de resultados de búsqueda de UNA familia, con la misma forma que
 * consume la paginación de Descubrir (`items` / `totalPages` / `hasMore`).
 *
 * `totalPages` es `null` cuando el proveedor no da un total fiable para la
 * búsqueda; la UI pinta entonces ventana abierta (patrón E79-s2).
 */
export interface SearchPage {
  items: MediaItem[];
  totalPages: number | null;
  hasMore: boolean;
}

/** Ítems por página de búsqueda (= page-size de Descubrir). */
const SEARCH_PAGE_SIZE = 20;

/**
 * Busca en una familia con paginación real donde el proveedor la soporta:
 *   - movie/tv (TMDB `/search/*`): `page` + `total_pages`.
 *   - anime (AniList): `page` + `lastPage`.
 *   - manga (MangaDex): `offset` + `total`.
 *   - book (Open Library): `page` + `numFound`.
 *   - game (RAWG `/games?search=`): `page` + `count`.
 *   - comic (ComicVine `/search/` de volúmenes): `page` + total, 10 por página.
 * Cada página sale ordenada por relevancia (`rankSearchResults`). El tope
 * común de páginas lo aplica el llamador (`fetchDiscoverData`).
 */
export async function searchByTypePaged(
  query: string,
  type: MediaType,
  page = 1,
  locale?: string | null
): Promise<SearchPage> {
  switch (type) {
    case "movie": {
      const r = await searchMovies(query, page, locale);
      const totalPages = Math.max(r.total_pages ?? 1, 1);
      return {
        items: rankSearchResults(
          query,
          r.results.map((raw) => normalizeMovie(raw as TmdbMovieDetail))
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "tv": {
      const r = await searchTV(query, page, locale);
      const totalPages = Math.max(r.total_pages ?? 1, 1);
      return {
        items: rankSearchResults(
          query,
          r.results.map((raw) => normalizeTV(raw as TmdbTVDetail))
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "anime": {
      // E-ANIME-RESPALDO: mismo respaldo que Descubrir.
      const r = await searchAnime(query, page).catch(async (e) => {
        const alt = await searchAnimeTmdb(query, page, locale).catch(() => null);
        if (!alt) throw e;
        return alt;
      });
      if ("items" in r) {
        return {
          items: rankSearchResults(query, r.items),
          totalPages: r.totalPages,
          hasMore: page < r.totalPages,
        };
      }
      const totalPages = Math.max(r.pageInfo?.lastPage ?? 1, 1);
      return {
        items: rankSearchResults(
          query,
          r.media.map((raw) => normalizeAniListAnime(raw))
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "manga":
      return searchMangaPage(query, page, locale);
    case "book": {
      // E-BOOKS-HIBRIDO: el buscador va contra el MISMO proveedor que el
      // catálogo. Si fuese contra otro, buscar y navegar serían dos mundos
      // distintos, y un fallo de cuota de Google rompería el buscador mientras
      // el catálogo sigue funcionando. Sin acotar por idioma: quien busca un
      // título concreto debe encontrarlo aunque solo exista el original.
      // `numFound` es un total real, así que la paginación no promete páginas
      // que el proveedor no sirve.
      const r = await searchOpenLibrary(query, page);
      const totalPages = openLibraryTotalPages(r.numFound);
      return {
        items: rankSearchResults(
          query,
          (r.docs ?? []).map((doc) => normalizeBookOpenLibrary(doc))
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "game": {
      const r = await searchGames(query, page);
      const totalPages = Math.max(
        Math.ceil((r.count ?? 0) / SEARCH_PAGE_SIZE),
        1
      );
      return {
        items: rankSearchResults(
          query,
          r.results.map((raw) => normalizeGame(raw))
        ),
        totalPages,
        hasMore: page < totalPages,
      };
    }
    case "comic":
      // ComicVine es server-only (COMICVINE_KEY): solo route handlers.
      return searchComicPage(query, page);
    default:
      return { items: [], totalPages: 1, hasMore: false };
  }
}
