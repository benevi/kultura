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
import {
  getPopularAnime,
  getPopularManga,
  discoverAnime,
  discoverManga,
  JikanError,
} from "@/lib/api/jikan";
import {
  buildJikanDiscoverParams,
  hasJikanFilters,
  filterByMinVolumes,
  type JikanFilters,
} from "@/lib/api/jikan-maps";
import {
  searchGoogleBooks,
  googleBooksTotalPages,
} from "@/lib/api/googlebooks";
import {
  buildGoogleBooksQuery,
  bookYearMatcher,
  hasBookFilters,
  GOOGLE_BOOKS_BASE_QUERY,
  type BooksFilters,
} from "@/lib/api/books-maps";
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
  normalizeAnime,
  normalizeMangaJikan,
  normalizeBookGoogle,
  normalizeGame,
} from "@/lib/api/normalizer";
import type { MediaItem } from "@/types/media";
import type { TmdbMovieDetail, TmdbTVDetail } from "@/lib/api/tmdb";
import type { JikanAnime, JikanManga } from "@/lib/api/jikan";
// Agregado modo "all" (R5a). Import diferido en uso (case "all") — el ciclo
// discover↔aggregate se resuelve en runtime porque ninguno se invoca en módulo.
import { fetchAggregateData } from "@/lib/api/aggregate";
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
      // E-BOOKS-GOOGLE: el año es post-filtro en Google Books (no hay operador
      // de fecha en la query) → el conteo crudo del proveedor deja de ser fiable.
      return Boolean(bookYearMatcher(filters.year));
    case "game":
      return Boolean(
        filters.valoracion ||
          filters.estado ||
          filters.modojuego?.length ||
          filters.duracionmedia
      );
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
 * cada familia consume nativamente: TMDB (F3a), Jikan + RAWG (F3b). Cada builder
 * toma solo los campos que entiende; el resto los ignora.
 */
export type DiscoverFilters = TmdbFilters &
  JikanFilters &
  RawgFilters &
  BooksFilters &
  ComicFilters;

/**
 * Resuelve una página de catálogo para una familia (o el agregado `all`).
 *
 * `locale` (E-TMDB-LOCALE): idioma activo de la app. Se propaga a los
 * proveedores que lo soportan — TMDB (`language`), Google Books
 * (`langRestrict`) y MangaDex (`availableTranslatedLanguage[]`). Jikan,
 * ComicVine y RAWG no ofrecen catálogo en español: limitación aceptada,
 * documentada en `src/lib/api/locale.ts`. Omitirlo equivale a `es`.
 */
export async function fetchDiscoverData(
  type: string,
  page: number,
  filters: DiscoverFilters = {},
  locale?: string | null
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
        // Con filtros → /anime (búsqueda, acepta filtros); sin filtros → /top/anime.
        const res = hasJikanFilters(filters)
          ? await discoverAnime(page, buildJikanDiscoverParams("anime", filters))
          : await getPopularAnime(page);
        const data = Array.isArray(res.data) ? (res.data as JikanAnime[]) : [];
        items = data.map((a) => normalizeAnime(a));
        // E79-s3: `last_visible_page` es el tope REAL de Jikan; se capa además
        // al tope común para que todas las familias ofrezcan la misma profundidad.
        const lastPage = res.pagination?.last_visible_page ?? 1;
        totalPages = Math.min(lastPage, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
      case "manga": {
        const res = hasJikanFilters(filters)
          ? await discoverManga(page, buildJikanDiscoverParams("manga", filters))
          : await getPopularManga(page);
        const data = Array.isArray(res.data) ? (res.data as JikanManga[]) : [];
        items = data.map((m) => normalizeMangaJikan(m));
        // POST-filtro de volúmenes (solo manga): umbral mínimo sobre metadata.volumes.
        // Vacío/desconocido → no filtra. anime no pasa por aquí (oculto).
        items = filterByMinVolumes(items, filters.volumenes);
        const lastPage = res.pagination?.last_visible_page ?? 1;
        totalPages = Math.min(lastPage, DISCOVER_MAX_PAGES);
        hasMore = page < totalPages;
        break;
      }
      case "book": {
        // E-BOOKS-GOOGLE: Google Books /volumes. Con filtros (género/editorial/
        // formato/idioma/sort) → query construida; sin filtros, query base
        // (Google Books exige `q` no vacío). El IDIOMA del catálogo lo fija
        // `langRestrict` con el locale activo dentro de `searchGoogleBooks`; el
        // trigger `idioma` de la UI actúa como override explícito.
        const { q, params } = hasBookFilters(filters)
          ? buildGoogleBooksQuery(filters)
          : { q: GOOGLE_BOOKS_BASE_QUERY, params: {} };
        const res = await searchGoogleBooks(q, page, params, locale);
        items = (res.items ?? []).map((v) => normalizeBookGoogle(v));
        // POST-filtro de año: Google Books no tiene operador de fecha en la
        // query (Open Library sí lo tenía) → se filtra sobre el año ya
        // normalizado. `hasActivePostFilter('book', …)` marca totalPages como
        // no fiable cuando está activo.
        const yearMatcher = bookYearMatcher(filters.year);
        if (yearMatcher) items = items.filter((i) => yearMatcher(i.year));
        // E79-s3: cap COMÚN (antes 50, heredado de la etapa Open Library).
        totalPages = Math.min(
          googleBooksTotalPages(res.totalItems),
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
    if (e instanceof JikanError && e.status === 429) {
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
