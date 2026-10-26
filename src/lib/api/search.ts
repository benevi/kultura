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
//   - Respaldo por familia: manga → AniList (y MyAnimeList); cómic → Google Books
//     (novela gráfica). Juegos sin respaldo: la ficha de juego solo abre ids de
//     RAWG (pendiente de la ficha pública, F-15).
// ============================================================

import type { MediaItem, MediaType } from "@/types/media";
import { searchMovies, searchTV } from "./tmdb";
import { normalizeAniListManga, searchAnime, searchMangaAniList } from "./anilist";
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
import {
  openLibraryTotalPages,
  searchOpenLibrary,
  searchOpenLibraryByTitle,
  type OpenLibraryResponse,
} from "./openlibrary";
import { searchGames } from "./rawg";
import { COMIC_SEARCH_PAGE_SIZE, searchComicVolumes } from "./comicvine";
import { searchComicsGoogleBooks, searchGoogleBooks } from "./googlebooks";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAniListAnime,
  normalizeMangaDex,
  normalizeBookOpenLibrary,
  normalizeBookGoogle,
  normalizeGame,
} from "./normalizer";
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

// ── Complemento de manga: memoria de fallos ────────────────────────────────
//
// El complemento (AniList) cachea 24 h lo que RESPONDE, pero un fallo (plazo
// agotado, 429, caído) no se cachea en ningún sitio: cada búsqueda de la misma
// consulta volvería a esperarlo. Se recuerda aquí unos minutos por consulta, y
// mientras tanto la búsqueda sale solo con MangaDex.

/** Minutos que un fallo del complemento evita volver a preguntar por esa consulta. */
export const MANGA_SUPPLEMENT_FAILURE_TTL_MS = 10 * 60_000;
const SUPPLEMENT_FAILURES_MAX = 500;
const supplementFailures = new Map<string, number>();

function supplementKey(query: string): string {
  return titleIdentity(query);
}

function supplementRecentlyFailed(query: string, now = Date.now()): boolean {
  const until = supplementFailures.get(supplementKey(query));
  if (until === undefined) return false;
  if (until > now) return true;
  supplementFailures.delete(supplementKey(query));
  return false;
}

function rememberSupplementFailure(query: string, now = Date.now()): void {
  if (supplementFailures.size >= SUPPLEMENT_FAILURES_MAX) supplementFailures.clear();
  supplementFailures.set(supplementKey(query), now + MANGA_SUPPLEMENT_FAILURE_TTL_MS);
}

/** Olvida los fallos recordados. Pensado para los tests. */
export function resetMangaSupplementFailures(): void {
  supplementFailures.clear();
}

/** Opciones de la búsqueda por familia. */
export interface SearchOptions {
  /**
   * Manga: completar con AniList cuando MangaDex no tiene la obra
   * (por defecto, sí). `type=all` lo apaga: ahí la obra suele ser de otra
   * familia ("dune", "interstellar") y la espera no compensa.
   */
  supplement?: boolean;
}

/** Manga de AniList (`al-{id}`): la ficha y la biblioteca los resuelven. */
async function searchMangaAniListItems(query: string): Promise<MediaItem[]> {
  return (await searchMangaAniList(query)).map((raw) => normalizeAniListManga(raw));
}


/**
 * Búsqueda de manga: MangaDex por relevancia + nota (`/statistics/manga`).
 *   - Si MangaDex falla, AniList como respaldo (una sola llamada, 2,5 s y sin
 *     reintento). MyAnimeList ya no entra en la búsqueda: desde Vercel no
 *     responde a tiempo y en serie solo añadía espera.
 *   - Si en la primera página ninguna obra se llama como la consulta (obras
 *     retiradas de MangaDex por licencia: "Berserk", "Vagabond"), se añaden
 *     las coincidencias exactas de AniList. Antes era MyAnimeList, pero desde
 *     Vercel Jikan no responde a tiempo y el spin-off se quedaba arriba
 *     («Berserk - The Prototype» en `rel.py` contra producción).
 */
async function searchMangaPage(
  query: string,
  page: number,
  locale?: string | null,
  opts: SearchOptions = {}
): Promise<SearchPage> {
  let r;
  try {
    r = await searchManga(query, (page - 1) * MANGADEX_PAGE_SIZE, locale);
  } catch (e) {
    // AniList no pagina aquí: el respaldo es la primera página y nada más.
    if (page !== 1) throw e;
    const ani = await searchMangaAniListItems(query).catch(() => null);
    if (!ani || ani.length === 0) throw e;
    return { items: rankSearchResults(query, ani), totalPages: 1, hasMore: false };
  }
  const stats = await getMangaStatistics(r.data.map((m) => m.id));
  let items = r.data.map((raw) => enrichMangaDexItem(raw, locale, stats.get(raw.id)));

  if (
    opts.supplement !== false &&
    page === 1 &&
    query.trim().length >= 3 &&
    !items.some((i) => isExactTitleMatch(query, i)) &&
    !supplementRecentlyFailed(query)
  ) {
    const extra = await searchMangaAniListItems(query).catch(() => {
      rememberSupplementFailure(query);
      return null;
    });
    const exact = (extra ?? []).filter((i) => isExactTitleMatch(query, i));
    const seen = new Set(items.map(workKey));
    items = [...exact.filter((i) => !seen.has(workKey(i))), ...items];
  }

  const totalPages = Math.max(Math.ceil((r.total ?? 0) / MANGADEX_PAGE_SIZE), 1);
  return { items: rankSearchResults(query, items), totalPages, hasMore: page < totalPages };
}

// ── Libros: respaldo cuando Open Library va lenta ────────────────────────────

/**
 * Si la búsqueda general de Open Library (`q=`) no ha respondido en este
 * tiempo, se lanza en paralelo la búsqueda por título (`title=`) y gana la
 * primera que responda. `rel.py` contra producción dio `don quijote` → error
 * a los 8,2 s (plazo agotado de `q=`).
 */
export const BOOK_HEDGE_MS = 2500;

/**
 * La primera promesa que se cumpla de `primary` y de `fallback()`, que se
 * lanza al vencer `delayMs` o en cuanto `primary` falla. Si fallan las dos,
 * rechaza con el error de `primary`.
 */
function hedged<T>(primary: Promise<T>, fallback: () => Promise<T>, delayMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    let primaryError: unknown;
    let primaryFailed = false;
    let fallbackStarted = false;
    let fallbackFailed = false;
    const finish = (value: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const maybeReject = () => {
      if (!done && primaryFailed && fallbackStarted && fallbackFailed) {
        done = true;
        reject(primaryError);
      }
    };
    const startFallback = () => {
      if (fallbackStarted || done) return;
      fallbackStarted = true;
      fallback().then(finish, () => {
        fallbackFailed = true;
        maybeReject();
      });
    };
    const timer = setTimeout(startFallback, delayMs);
    primary.then(finish, (e) => {
      primaryFailed = true;
      primaryError = e;
      clearTimeout(timer);
      startFallback();
      maybeReject();
    });
  });
}

function openLibraryPage(query: string, page: number, r: OpenLibraryResponse): SearchPage {
  const totalPages = openLibraryTotalPages(r.numFound);
  return {
    items: rankSearchResults(query, (r.docs ?? []).map((doc) => normalizeBookOpenLibrary(doc))),
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Libros: Open Library (`q=`); si tarda, por título; si Open Library entera
 * falla, Google Books (que desde Vercel responde 503 sin clave propia).
 */
async function searchBookPage(query: string, page: number, locale?: string | null): Promise<SearchPage> {
  // La que pierde la carrera se cancela: no sigue ocupando la función ni
  // gastando una petición a Open Library hasta su plazo de 8 s.
  const primaryCtl = new AbortController();
  const fallbackCtl = new AbortController();
  const primary = searchOpenLibrary(query, page, {}, undefined, undefined, primaryCtl.signal)
    .then((r) => openLibraryPage(query, page, r))
    .then((res) => {
      fallbackCtl.abort();
      return res;
    });
  const fallback = () =>
    searchOpenLibraryByTitle(query, page, undefined, fallbackCtl.signal)
      .then((r) => {
        primaryCtl.abort();
        return openLibraryPage(query, page, r);
      })
      .catch(async () => {
        const g = await searchGoogleBooks(query, page, {}, locale);
        const items = (g.items ?? []).map((raw) => normalizeBookGoogle(raw));
        const totalPages = Math.max(Math.ceil((g.totalItems ?? 0) / SEARCH_PAGE_SIZE), 1);
        return { items: rankSearchResults(query, items), totalPages, hasMore: page < totalPages };
      });
  return hedged(primary, fallback, BOOK_HEDGE_MS);
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
 * ya ordenado por relevancia. La usa el autocompletado (`/api/search?type=`),
 * así que va SIN complemento de manga: cada tecla sería una llamada a
 * AniList, y un 429 abriría su circuito y dejaría sin anime toda la app
 * durante 10 min.
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
  return (await searchByTypePaged(query, type, 1, locale, { supplement: false })).items;
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
  locale?: string | null,
  opts: SearchOptions = {}
): Promise<SearchPage> {
  switch (type) {
    case "movie": {
      const r = await searchMovies(query, page, locale);
      const totalPages = Math.max(r.total_pages ?? 1, 1);
      return {
        items: rankSearchResults(
          query,
          r.results.map((raw) => normalizeMovie(raw))
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
          r.results.map((raw) => normalizeTV(raw))
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
      return searchMangaPage(query, page, locale, opts);
    case "book":
      // E-BOOKS-HIBRIDO: el buscador va contra el MISMO proveedor que el
      // catálogo (Open Library), sin acotar por idioma: quien busca un título
      // concreto debe encontrarlo aunque solo exista el original. `numFound`
      // es un total real. F-13: con respaldo si Open Library tarda o cae.
      return searchBookPage(query, page, locale);
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
