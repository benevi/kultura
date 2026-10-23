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
// exactamente el mismo mecanismo que `isMangaDexId`/`isOpenLibraryWorkId`
// para manga/libros.
// ============================================================

import type { ZodType } from "zod";
import type { MediaItem } from "@/types/media";
import { providerFetch } from "@/lib/api/http";
import { anilistMediaSchema, anilistPageSchema } from "@/lib/api/schemas/anilist";

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

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; status?: number }[];
}

/**
 * Error a nivel de query (GraphQL), no de transporte: llega con HTTP 200 y no
 * es transitorio, así que no se reintenta (p. ej. variable inválida, id
 * inexistente → 404 real). Se lanza dentro de `providerFetch`, así que esa
 * respuesta tampoco se guarda en caché.
 */
function checkGraphQLErrors(json: unknown): void {
  const errors = (json as GraphQLResponse<unknown> | null)?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    throw new AniListError(errors[0]?.message ?? "error", errors[0]?.status ?? 200);
  }
}

interface AniListCallOptions {
  cache?: { revalidate: number };
  /** Plazo por intento (por defecto el general de `providerFetch`, 6 s). */
  timeoutMs?: number;
  /** Reintentos ante 5xx (por defecto 1). */
  retries?: number;
}

async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown>,
  schema?: ZodType,
  opts: AniListCallOptions = {}
): Promise<T> {
  const json = await providerFetch<GraphQLResponse<T>>("anilist", ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // POST de GraphQL: se cachea por cuerpo (consulta + variables).
    body: JSON.stringify({ query, variables }),
    label: "graphql",
    schema,
    retries: opts.retries ?? 1,
    retryOn: ANILIST_RETRYABLE_STATUS,
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    checkBody: checkGraphQLErrors,
    httpError: (status) => new AniListError("request failed", status),
    ...(opts.cache ? { cache: opts.cache } : {}),
  });
  return json.data as T;
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
  const data = await anilistFetch<{ Page: AniListPage }>(
    DISCOVER_QUERY,
    { page, perPage: ANILIST_PAGE_SIZE, ...params },
    anilistPageSchema
  );
  return data.Page;
}

export async function searchAnime(
  query: string,
  page = 1
): Promise<AniListPage> {
  const data = await anilistFetch<{ Page: AniListPage }>(
    DISCOVER_QUERY,
    { page, perPage: ANILIST_PAGE_SIZE, search: query, sort: ["SEARCH_MATCH"] },
    anilistPageSchema
  );
  return data.Page;
}

export async function getAnime(id: number): Promise<AniListMedia> {
  const data = await anilistFetch<{ Media: AniListMedia }>(
    DETAIL_QUERY,
    { id },
    anilistMediaSchema
  );
  return data.Media;
}

/**
 * true si `id` tiene forma de referencia AniList (`al-{entero}`). Los ids
 * legacy de Jikan (bibliotecas guardadas cuando anime venía de MAL) son
 * enteros planos — nunca calzan este patrón. Mismo mecanismo que
 * `isMangaDexId` (mangadex.ts) / `isOpenLibraryWorkId` (googlebooks.ts).
 */
/**
 * Sonda barata para `/api/health?deep=1`: un único campo de un título fijo
 * (Cowboy Bebop, id 1), sin caché.
 */
export async function probeAniList(): Promise<void> {
  await providerFetch("anilist", ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query { Media(id: 1, type: ANIME) { id } }" }),
    label: "graphql probe",
    schema: anilistMediaSchema,
    checkBody: checkGraphQLErrors,
    httpError: (status) => new AniListError("request failed", status),
    cache: false,
  });
}

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

// ── Manga (F-13): complemento y respaldo de la búsqueda ──────────────────────
//
// MangaDex no tiene las obras retiradas por licencia ("Berserk", "Vagabond").
// El complemento era MyAnimeList (Jikan), pero desde Vercel Jikan no responde
// a tiempo (la ficha de un manga legacy tarda ~7 s en caer) y la búsqueda se
// quedaba con el spin-off arriba. AniList responde en ~150 ms y tiene esas
// obras con nota y portada. Ids `al-{id}` (como el anime), que la ficha y la
// biblioteca resuelven con `getMangaAniList`.

const MANGA_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
  coverImage { extraLarge large }
  description(asHtml: false)
  genres
  averageScore
  popularity
  startDate { year }
  chapters
  volumes
  status
  format
`;

const MANGA_SEARCH_QUERY = `
  query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      pageInfo { currentPage lastPage hasNextPage total }
      media(type: MANGA, isAdult: false, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        ${MANGA_FIELDS}
      }
    }
  }
`;

const MANGA_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      ${MANGA_FIELDS}
    }
  }
`;

export interface AniListManga {
  id: number;
  idMal?: number | null;
  title: AniListTitle;
  synonyms?: string[] | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  description?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  popularity?: number | null;
  startDate?: { year?: number | null } | null;
  chapters?: number | null;
  volumes?: number | null;
  status?: string | null;
  format?: string | null;
}

/** Una búsqueda de complemento se cachea 24 h: las obras no cambian de nombre. */
export const ANILIST_MANGA_SEARCH_REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * Plazo de la búsqueda de manga en AniList, SIN reintento: va en serie
 * después de MangaDex y no puede alargar la búsqueda más de esto (con el
 * general serían 6 s + reintento, hasta 8 s). AniList suele tardar ~150 ms.
 */
export const ANILIST_MANGA_SEARCH_TIMEOUT_MS = 2500;

/** Busca manga en AniList (primeros 10, por coincidencia y popularidad). */
export async function searchMangaAniList(query: string, perPage = 10): Promise<AniListManga[]> {
  const data = await anilistFetch<{ Page: { media: AniListManga[] } }>(
    MANGA_SEARCH_QUERY,
    { search: query, perPage },
    anilistPageSchema,
    {
      cache: { revalidate: ANILIST_MANGA_SEARCH_REVALIDATE_SECONDS },
      timeoutMs: ANILIST_MANGA_SEARCH_TIMEOUT_MS,
      retries: 0,
    }
  );
  return data.Page?.media ?? [];
}

/** Detalle de un manga de AniList (ficha y biblioteca de ids `al-{id}`). */
export async function getMangaAniList(id: number): Promise<AniListManga> {
  const data = await anilistFetch<{ Media: AniListManga }>(MANGA_DETAIL_QUERY, { id }, anilistMediaSchema);
  return data.Media;
}

function plainDescription(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  return plain || undefined;
}

/**
 * AniList (manga) → MediaItem. Aquí y no en `normalizer.ts` porque este
 * módulo es el único que lo usa y `normalizer.ts` ya importa de él.
 */
export function normalizeAniListManga(raw: AniListManga): MediaItem {
  const externalId = toAniListRef(raw.id);
  const title = raw.title.english ?? raw.title.romaji ?? raw.title.native ?? "Unknown";
  const year = raw.startDate?.year ?? undefined;
  return {
    id: `manga_${externalId}`,
    externalId,
    type: "manga",
    title,
    originalTitle: raw.title.romaji && raw.title.romaji !== title ? raw.title.romaji : undefined,
    poster: raw.coverImage?.large || raw.coverImage?.extraLarge || undefined,
    year: typeof year === "number" && year > 1800 ? year : undefined,
    synopsis: plainDescription(raw.description),
    genres: raw.genres?.length ? raw.genres : undefined,
    rating: typeof raw.averageScore === "number" ? raw.averageScore / 10 : undefined,
    ratingSource: "AniList",
    metadata: {
      nativeTitle: raw.title.native ?? undefined,
      altTitles: [raw.title.romaji, raw.title.english, ...(raw.synonyms ?? [])].filter(
        (t): t is string => typeof t === "string" && t.length > 0
      ),
      follows: typeof raw.popularity === "number" ? raw.popularity : undefined,
      chapters: raw.chapters ?? undefined,
      volumes: raw.volumes ?? undefined,
      status: raw.status ?? undefined,
      format: raw.format ?? undefined,
      malId: raw.idMal ?? undefined,
    },
  };
}
