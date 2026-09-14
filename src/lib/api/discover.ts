// ============================================================
// KULTURA — Discover data fetching logic
// Extracted from app/[locale]/(app)/discover/page.tsx for testability.
// ============================================================

import { createLogger } from "@/lib/logger";
import { discoverMovies, discoverTV } from "@/lib/api/tmdb";
import {
  buildTmdbDiscoverParams,
  filterTVByTemporadas,
  type TmdbFilters,
} from "@/lib/api/tmdb-maps";
import { JikanError } from "@/lib/api/jikan";
import { AniListError, discoverAnime } from "@/lib/api/anilist";
import {
  buildAniListDiscoverParams,
  type AniListFilters,
} from "@/lib/api/anilist-maps";
import { getPopularManga, discoverManga } from "@/lib/api/mangadex";
import {
  buildMangaDexDiscoverParams,
  hasMangaDexFilters,
  filterByMinVolumesDex,
  type MangaDexFilters,
} from "@/lib/api/mangadex-maps";
import { GoogleBooksError } from "@/lib/api/googlebooks";
import {
  searchOpenLibrary,
  openLibraryTotalPages,
} from "@/lib/api/openlibrary";
import {
  buildOpenLibraryQuery,
  type OpenLibraryBookFilters,
} from "@/lib/api/openlibrary-maps";
import { getPopularGames, discoverGames } from "@/lib/api/rawg";
import {
  buildRawgDiscoverParams,
  applyGamePostFilters,
  type RawgFilters,
} from "@/lib/api/rawg-maps";
import { getRecentComics } from "@/lib/api/comicvine";
import {
  hasComicFilters,
  type ComicFilters,
} from "@/lib/api/comicvine-maps";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAniListAnime,
  normalizeMangaDex,
  normalizeGame,
  normalizeBookOpenLibrary,
} from "@/lib/api/normalizer";
import type { MediaItem, MediaType } from "@/types/media";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
// Agregado modo "all" (R5a). Import diferido en uso (case "all") — el ciclo
// discover↔aggregate se resuelve en runtime porque ninguno se invoca en módulo.
import { fetchAggregateData, fetchAggregateSearch } from "@/lib/api/aggregate";
import { searchByTypePaged } from "@/lib/api/search";
import { filterNSFW } from "@/lib/api/nsfw-filter";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";

const log = createLogger("discover");

export type FetchErrorKind = "rate-limit" | "generic" | null;

// Tope COMÚN de páginas para todas las familias (E79-s3) → lib/api/pagination.ts.

// E79 slice 2 — ¿hay un post-filtro ACTIVO que recorte items tras el fetch sin
// recomputar el conteo del proveedor? Si lo hay, totalPages crudo miente y se
// devuelve `null`. Solo cuenta el post-filtro específico de la familia con VALOR;
// NSFW global (siempre activo, recorte marginal) se excluye a propósito.
//   - tv    → temporadas
//   - manga → volumenes
//   - book  → anio (post-filtro desde E-BOOKS-GOOGLE)
//   - game  → valoracion | estado | modojuego | duracionmedia
//   - comic → editorial | volumenes (post-filtro sobre publisher/volumen
//     resuelto vía /volumes tras el fetch de /issues — `total` de ComicVine
//     NUNCA refleja este recorte, ver getRecentComics en comicvine.ts)
function hasActivePostFilter(
  type: string,
  filters: DiscoverFilters
): boolean {
  switch (type) {
    case "tv":
      return Boolean(filters.temporadas);
    case "manga":
      return Boolean(filters.volumenes);
    case "book":
      // E-BOOKS-HIBRIDO: ya NO hay post-filtro en libros. Open Library aplica
      // el año como rango (`first_publish_year:[a TO b]`) y devuelve un
      // `numFound` que ya lo refleja, así que el conteo vuelve a ser fiable y
      // la UI puede volver a ofrecer la última página.
      return false;
    case "game":
      return Boolean(
        filters.valoracion ||
          filters.estado ||
          filters.modojuego?.length ||
          filters.duracionmedia
      );
    case "comic":
      return Boolean(filters.editorial?.length || filters.volumenes);
    default:
      return false;
  }
}

export interface DiscoverResult {
  items: MediaItem[];
  // E79 slice 2 — `null` = totalPages NO fiable: la familia tiene un post-filtro
  // ACTIVO (tv+temporadas, manga+volumenes, game+valoracion/estado/modojuego/
  // duracionmedia) que recorta items DESPUÉS del fetch sin recomputar el conteo
  // del proveedor → el N crudo (p.ej. RAWG count=900360 → 45018 páginas) miente.
  // La UI (Pagination) omite la "última página [N]" y no permite saltar a ella;
  // el gate de "siguiente" ya usa hasMore, no esto. Cuando es un número, la
  // ventana numerada completa es fiable. Elegido `number|null` sobre un bool
  // paralelo: hace IMPOSIBLE leer un N obsoleto cuando no es fiable (no hay valor
  // que pintar), en vez de confiar en que el consumidor mire el flag. El post-
  // filtro NSFW global NO cuenta (recorte marginal, aplica a todas las familias).
  totalPages: number | null;
  // E79 slice 1 — "has-next": ¿la FUENTE cruda tiene más páginas tras la actual?
  // Se computa contra el total del proveedor (PRE-post-filtro), no contra los
  // items servidos. El post-filtro (temporadas/volumenes/game-suite/NSFW) recorta
  // lo visible pero NO cambia si hay más fuente que paginar → el gate de "next"
  // se basa en esto, no en totalPages (que sigue inflado por el mismo motivo).
  hasMore: boolean;
  fetchErrorKind: FetchErrorKind;
}

/**
 * Filtros canónicos aplicables a la capa de fetch. Unión de los subconjuntos que
 * cada familia consume nativamente. Cada builder toma solo los campos que
 * entiende; el resto los ignora.
 */
export type DiscoverFilters = TmdbFilters &
  AniListFilters &
  MangaDexFilters &
  RawgFilters &
  OpenLibraryBookFilters &
  ComicFilters;

/**
 * Resuelve una página de catálogo para una familia (o el agregado `all`).
 *
 * `locale` (E-TMDB-LOCALE): idioma activo de la app. Se propaga a los
 * proveedores que lo soportan — TMDB (`language`), Open Library (`language`,
 * E-BOOKS-HIBRIDO) y MangaDex (`availableTranslatedLanguage[]`). Jikan,
 * ComicVine y RAWG no ofrecen catálogo en español: limitación aceptada,
 * documentada en `src/lib/api/locale.ts`. Omitirlo equivale a `es`.
 *
 * `query` (E-DISCOVER-SEARCH-MERGE): cuando llega, la página NO viene del
 * catálogo de descubrir sino del buscador del proveedor para ese tipo, con la
 * MISMA forma de respuesta (`items`/`totalPages`/`hasMore`) para que el grid y
 * la paginación de Descubrir funcionen sin cambios. Los filtros de catálogo no
 * se aplican en modo búsqueda: ningún buscador de los proveedores acepta esos
 * parámetros, y aplicarlos client-side daría páginas cortas (por eso la UI
 * oculta la barra de filtros mientras hay query).
 */
export async function fetchDiscoverData(
  type: string,
  page: number,
  filters: DiscoverFilters = {},
  locale?: string | null,
  query?: string | null
): Promise<DiscoverResult> {
  let items: MediaItem[] = [];
  let totalPages = 1;
  // E79 slice 1: hasMore = page < providerTotalPages. Se setea por familia con
  // el total del proveedor que ya se computa; default false (última/única página).
  let hasMore = false;
  let fetchErrorKind: FetchErrorKind = null;

  // E79-s3: página fuera del tope común (URL escrita a mano o salto de la UI
  // numerada) → página vacía SIN llamar a ningún proveedor y SIN banner de
  // error (`fetchErrorKind: null`), que es distinto de un fallo de red real.
  // Antes este guard existía solo para TMDB (E89) y solo a 500.
  if (page > DISCOVER_MAX_PAGES) {
    return {
      items: [],
      totalPages: DISCOVER_MAX_PAGES,
      hasMore: false,
      fetchErrorKind: null,
    };
  }

/**
 * ¿El fallo es "el proveedor me está limitando" (429)?
 *
 * Importa porque la UI tiene un mensaje distinto para eso ("inténtalo en unos
 * segundos") que para un fallo genérico. Antes solo se reconocía a Jikan y
 * AniList, así que una cuota agotada de Google Books se presentaba como un
 * error indeterminado y no había forma de saber desde la pantalla qué pasaba.
 */
function isRateLimitError(e: unknown): boolean {
  return (
    (e instanceof JikanError ||
      e instanceof AniListError ||
      e instanceof GoogleBooksError) &&
    e.status === 429
  );
}

  // ── Modo BÚSQUEDA (E-DISCOVER-SEARCH-MERGE) ───────────────────────────────
  if (query) {
    try {
      const res =
        type === "all"
          ? await fetchAggregateSearch(query, page, locale)
          : await searchByTypePaged(query, type as MediaType, page, locale);
      // El tope común también manda en búsqueda.
      const totalPages =
        res.totalPages === null
          ? null
          : Math.min(res.totalPages, DISCOVER_MAX_PAGES);
      return {
        items: filterNSFW(res.items),
        totalPages,
        hasMore: res.hasMore && page < DISCOVER_MAX_PAGES,
        fetchErrorKind: null,
      };
    } catch (e) {
      console.error(`[discover] search error (type=${type} page=${page}):`, e);
      return {
        items: [],
        totalPages: 1,
        hasMore: false,
        fetchErrorKind: isRateLimitError(e) ? "rate-limit" : "generic",
      };
    }
  }

  try {
    switch (type) {
      case "movie": {
        const res = await discoverMovies(
          page,
          buildTmdbDiscoverParams("movie", filters),
          locale
        );
        items = res.results.map((m) =>
          normalizeMovie(m as unknown as TmdbMovieDetail)
        );
        // E79-s3: cap COMÚN. hasMore se gobierna contra el cap también (la última
        // página no ofrece "siguiente" aunque total_pages crudo sea mayor).
        totalPages = Math.min(res.total_pages, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
      case "tv": {
        const res = await discoverTV(
          page,
          buildTmdbDiscoverParams("tv", filters),
          locale
        );
        items = res.results.map((tv) =>
          normalizeTV(tv as unknown as TmdbTVDetail)
        );
        // POST-filtro temporadas (R4c-2): bucket sobre metadata.seasons. NO gatea
        // el fetch nativo (no está en el builder). Vacío → no filtra.
        items = filterTVByTemporadas(items, filters.temporadas);
        // E79-s3: cap COMÚN (igual que movie).
        totalPages = Math.min(res.total_pages, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
      case "anime": {
        // E-ANIME-SOURCE (2026-09-13): AniList reemplaza a Jikan/MAL — Jikan
        // sufría 504 sostenidos en producción (confirmado por logs reales, en
        // AMBOS endpoints probados, `/top/anime` y `/anime`), decisión
        // explícita del usuario. AniList pagina por page/perPage nativo.
        const res = await discoverAnime(
          page,
          buildAniListDiscoverParams(filters)
        );
        const data = Array.isArray(res.media) ? res.media : [];
        items = data.map((a) => normalizeAniListAnime(a));
        const lastPage = res.pageInfo?.lastPage ?? 1;
        totalPages = Math.min(lastPage, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
      case "manga": {
        // E-MANGA-SOURCE: MangaDex (no Jikan) — único proveedor con catálogo
        // realmente traducido. MangaDex pagina por offset/limit, no por page.
        const offset = (page - 1) * 20;
        const res = hasMangaDexFilters(filters)
          ? await discoverManga(
              offset,
              buildMangaDexDiscoverParams(filters),
              locale
            )
          : await getPopularManga(offset, locale);
        // E29: mismo guard que anime — nunca confiar en que el proveedor
        // devuelva `data` como array (null/undefined no debe lanzar TypeError).
        const mangaData = Array.isArray(res.data) ? res.data : [];
        items = mangaData.map((m) => normalizeMangaDex(m, locale));
        // POST-filtro de volúmenes (solo manga): umbral mínimo sobre metadata.volumes.
        // Vacío/desconocido → no filtra. anime no pasa por aquí (oculto).
        items = filterByMinVolumesDex(items, filters.volumenes);
        totalPages = Math.min(
          Math.max(Math.ceil((res.total ?? 0) / 20), 1),
          DISCOVER_MAX_PAGES
        );
        hasMore = page < totalPages;
        break;
      }
      case "book": {
        // E-BOOKS-HIBRIDO: el CATÁLOGO lo sirve Open Library. A diferencia de
        // Google Books, aquí el idioma es un facet real, el año es un rango
        // real y `numFound` es un total real — los tres motivos por los que la
        // pestaña de libros daba títulos en inglés, filtros vacíos y errores al
        // paginar. La ficha sigue enriqueciéndose con Google Books.
        const { q, params } = buildOpenLibraryQuery(filters, locale);
        const res = await searchOpenLibrary(q, page, params);
        items = (res.docs ?? []).map((doc) => normalizeBookOpenLibrary(doc));
        totalPages = Math.min(
          openLibraryTotalPages(res.numFound),
          DISCOVER_MAX_PAGES
        );
        hasMore = page < totalPages;
        break;
      }
      case "comic": {
        // Con filtros (sort/year/editorial) → getRecentComics filtrado; sin
        // filtros, paridad con hoy. genre sigue oculto para comic.
        const res = hasComicFilters(filters)
          ? await getRecentComics(page, filters)
          : await getRecentComics(page);
        items = res.items;
        // E79-s3: antes SIN cap (se exponían todas las páginas que reporta
        // ComicVine; en offsets muy altos la API devuelve vacío). Ahora cap común.
        totalPages = Math.min(
          Math.max(Math.ceil(res.total / 20), 1),
          DISCOVER_MAX_PAGES
        );
        hasMore = page < totalPages;
        break;
      }
      case "game": {
        // Con filtros (género/plataforma/año/sort) → /games filtrado; sin filtros
        // se mantiene getPopularGames (ordering=-rating) para paridad F2.
        const hasRawgFilters = Boolean(
          filters.genre?.length ||
            filters.platform?.length ||
            filters.year ||
            filters.sort
        );
        const res = hasRawgFilters
          ? await discoverGames(page, buildRawgDiscoverParams(filters))
          : await getPopularGames(page);
        items = res.results.map((g) => normalizeGame(g));
        // POST-filtros game (R4c-1): valoracion(metacritic)/estado/modojuego/
        // duracionmedia. NO gatean el fetch (no están en hasRawgFilters); se
        // aplican tras normalizar, mismo patrón que volumenes×manga. Caveat
        // paginación E79 conocido (overfetch sin recomputar totalPages).
        items = applyGamePostFilters(items, filters);
        // E79-s3: antes SIN cap → RAWG count=900360 daba 45018 páginas fantasma.
        totalPages = Math.min(
          Math.max(Math.ceil(res.count / 20), 1),
          DISCOVER_MAX_PAGES
        );
        hasMore = page < totalPages;
        break;
      }
      case "all": {
        // Agregado E59 R5a: fan-out a las 7 familias + merge/orden por sortKey.
        // Delega en aggregate.ts (reusa este mismo pipeline por familia). Devuelve
        // ya su propio DiscoverResult → retorno directo (no pasa por el merge de
        // items/totalPages locales de esta función).
        return fetchAggregateData(page, filters, locale);
      }
      default: {
        // Fallback = TMDB movies → mismo cap que case "movie".
        const res = await discoverMovies(
          page,
          buildTmdbDiscoverParams("movie", filters),
          locale
        );
        items = res.results.map((m) =>
          normalizeMovie(m as unknown as TmdbMovieDetail)
        );
        totalPages = Math.min(res.total_pages, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
    }
  } catch (e) {
    log.error("API error", { type, page, err: e });
    if (isRateLimitError(e)) {
      fetchErrorKind = "rate-limit";
    } else {
      fetchErrorKind = "generic";
    }
    items = [];
    totalPages = 1;
    hasMore = false; // error → no hay siguiente que ofrecer.
  }

  // E86: post-filtro NSFW global, último paso antes del return. Cubre todas las
  // familias (movie/tv/anime/manga/book/comic/game). El agregado type=all retorna
  // antes (fetchAggregateData), pero cada familia que combina pasa por aquí → ya
  // filtrada. Complementa los filtros nativos (TMDB include_adult / Jikan sfw /
  // RAWG exclude_tags) capturando lo que escapa a la capa de API.
  items = filterNSFW(items);

  // E79 slice 2 — si un post-filtro específico de la familia está activo, el
  // totalPages crudo del proveedor miente (no refleja el recorte) → `null`, y la
  // UI omite la "última página [N]". En error (fetchErrorKind != null) totalPages
  // ya es 1 y no hay recorte que ocultar → se mantiene el número.
  const totalPagesOut: number | null =
    fetchErrorKind === null && hasActivePostFilter(type, filters)
      ? null
      : totalPages;

  return { items, totalPages: totalPagesOut, hasMore, fetchErrorKind };
}
