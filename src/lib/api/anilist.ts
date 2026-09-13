// ============================================================
// KULTURA — AniList API Integration (E-ANIME-SOURCE)
// GraphQL API pública de AniList (https://anilist.co). No requiere API key.
// Docs: https://docs.anilist.co/
//
// Sustituye a Jikan/MAL como fuente de anime (2026-09-13). Jikan sufría
// caídas 504 sostenidas — confirmado por logs reales de producción, en
// AMBOS endpoints que se probaron (`/top/anime` y `/anime`), no un blip ni
// un endpoint concreto — porque Jikan es un proxy/scraper no oficial sobre
// MyAnimeList. AniList tiene su propia infraestructura e ids propios.
//
// Ids: AniList usa enteros pequeños, igual que MAL — un mismo número no
// identifica de forma única la fuente. Las bibliotecas guardadas mientras
// anime venía de Jikan tienen `anime_{mal_id}` (entero plano); los nuevos
// items de AniList usan `anime_al-{id}` (prefijo `al-`, ver `isAniListId`),
// exactamente el mismo mecanismo que `isMangaDexId`/`isOpenLibraryLegacyId`
// para manga/libros.
// ============================================================

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// ── Internal types ────────────────────────────────────────────────────────────

export interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AniListMedia {
  id: number;
  title: AniListTitle;
  coverImage: { extraLarge: string | null; large: string | null };
  description: string | null;
  genres: string[];
  averageScore: number | null; // 0-100
  seasonYear: number | null;
  startDate: { year: number | null } | null;
  episodes: number | null;
  status: string; // FINISHED | RELEASING | NOT_YET_RELEASED | CANCELLED | HIATUS
  studios: { nodes: { name: string }[] } | null;
  trailer: { id: string; site: string } | null;
  source: string | null;
}

export interface AniListPageInfo {
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  total: number;
}

export interface AniListPage {
  pageInfo: AniListPageInfo;
  media: AniListMedia[];
}

// ── Error class ───────────────────────────────────────────────────────────────

export class AniListError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(`AniList → ${status}: ${message}`);
    this.name = "AniListError";
    this.status = status;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** 5xx retryables: fallos transitorios del backend de AniList, no del cliente
 * (a diferencia de un 429 de rate-limit, donde reintentar de inmediato solo
 * lo empeora — mismo criterio que `JIKAN_RETRYABLE_STATUS` en jikan.ts). */
const ANILIST_RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; status?: number }[];
}

async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(400);

    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "KulturaApp/1.0 (+https://kultura.app)",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.ok) {
      const json = (await res.json()) as GraphQLResponse<T>;
      if (json.errors?.length) {
        // Error a nivel de query (GraphQL), no de transporte: no es transitorio,
        // no se reintenta (p.ej. variable inválida, id inexistente → 404 real).
        throw new AniListError(json.errors[0].message, json.errors[0].status ?? res.status);
      }
      return json.data as T;
    }

    lastStatus = res.status;
    if (!ANILIST_RETRYABLE_STATUS.has(res.status)) break;
  }

  throw new AniListError("request failed", lastStatus!);
}

// ── Query fragments ───────────────────────────────────────────────────────────

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large }
  description(asHtml: false)
  genres
  averageScore
  seasonYear
  startDate { year }
  episodes
  status
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  source
`;

/**
 * Query única para descubrir/buscar (Page.media). Usada tanto por
 * `discoverAnime` (filtros de catálogo) como por `searchAnime` (`$search`) —
 * los argumentos no usados en una llamada concreta viajan como variable
 * `undefined`/`null`, y AniList los trata como "sin filtrar" (no lanza).
 */
const DISCOVER_QUERY = `
  query (
    $page: Int
    $perPage: Int
    $search: String
    $genre_in: [String]
    $seasonYear: Int
    $startDate_greater: FuzzyDateInt
    $startDate_lesser: FuzzyDateInt
    $status: MediaStatus
    $sort: [MediaSort]
    $averageScore_greater: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage lastPage hasNextPage total }
      media(
        type: ANIME
        isAdult: false
        search: $search
        genre_in: $genre_in
        seasonYear: $seasonYear
        startDate_greater: $startDate_greater
        startDate_lesser: $startDate_lesser
        status: $status
        sort: $sort
        averageScore_greater: $averageScore_greater
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
    }
  }
`;

// ── Public API ────────────────────────────────────────────────────────────────

/** Ítems por página — mismo page-size que el resto de familias de Descubrir. */
export const ANILIST_PAGE_SIZE = 20;

/** Filtros nativos ya traducidos (ver anilist-maps.ts) para `discoverAnime`. */
export interface AniListDiscoverParams {
  genre_in?: string[];
  seasonYear?: number;
  startDate_greater?: number;
  startDate_lesser?: number;
  status?: string;
  sort: string[];
  averageScore_greater?: number;
}

export async function discoverAnime(
  page: number,
  params: AniListDiscoverParams
): Promise<AniListPage> {
  const data = await anilistFetch<{ Page: AniListPage }>(DISCOVER_QUERY, {
    page,
    perPage: ANILIST_PAGE_SIZE,
    ...params,
  });
  return data.Page;
}

export async function searchAnime(
  query: string,
  page = 1
): Promise<AniListPage> {
  const data = await anilistFetch<{ Page: AniListPage }>(DISCOVER_QUERY, {
    page,
    perPage: ANILIST_PAGE_SIZE,
    search: query,
    sort: ["SEARCH_MATCH"],
  });
  return data.Page;
}

export async function getAnime(id: number): Promise<AniListMedia> {
  const data = await anilistFetch<{ Media: AniListMedia }>(DETAIL_QUERY, { id });
  return data.Media;
}

/**
 * true si `id` tiene forma de referencia AniList (`al-{entero}`). Los ids
 * legacy de Jikan (bibliotecas guardadas cuando anime venía de MAL) son
 * enteros planos — nunca calzan este patrón. Mismo mecanismo que
 * `isMangaDexId` (mangadex.ts) / `isOpenLibraryLegacyId` (googlebooks.ts).
 */
export function isAniListId(id: string): boolean {
  return /^al-\d+$/.test(id);
}

/** Construye la referencia AniList a partir del id numérico crudo. */
export function toAniListRef(id: number): string {
  return `al-${id}`;
}

/** Extrae el id numérico de AniList de una referencia `al-{id}`. */
export function fromAniListRef(ref: string): number {
  return Number(ref.slice(3));
}
