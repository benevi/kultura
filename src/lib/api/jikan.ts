// ============================================================
// KULTURA — Jikan API Integration
// Wrapper no oficial de MyAnimeList (v4). Docs: https://docs.api.jikan.moe/
// No requiere API key.
//
// ESTADO REAL: anime se sirve con AniList (E-ANIME-SOURCE, 2026-09-13; Jikan
// sufría 504 sostenidos en producción, confirmado por logs reales) y manga
// con MangaDex (E-MANGA-SOURCE). Este módulo se conserva SOLO para resolver
// ids legacy de bibliotecas guardadas cuando anime/manga aún venían de
// Jikan (ver `resolveAnimeItem` / `resolveMangaItem` en la ficha de detalle)
// y, desde F-13, como RESPALDO de la búsqueda de manga (`searchMangaJikan`):
// nunca en el catálogo de Descubrir.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

import { z, type ZodType } from "zod";
import { providerFetch } from "@/lib/api/http";
import { jikanDetailSchema, jikanVideosSchema } from "@/lib/api/schemas/jikan";

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: { jpg: { large_image_url: string } };
  synopsis: string | null;
  score: number | null; // 0-10
  genres: { name: string }[];
  year: number | null;
  episodes: number | null;
  status: string;
  studios: { name: string }[];
  source: string;
  trailer: { youtube_id: string | null };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JikanAnimeDetail extends JikanAnime {}

export interface JikanManga {
  mal_id: number;
  title: string;
  images: { jpg: { large_image_url: string } };
  synopsis: string | null;
  score: number | null; // 0-10
  genres: { name: string }[];
  published: { prop: { from: { year: number | null } } };
  chapters: number | null;
  volumes: number | null;
  status: string;
  authors: { name: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JikanMangaDetail extends JikanManga {}

export interface JikanVideosResponse {
  data: { promo: { trailer: { youtube_id: string } }[] };
}

// ── Error class ───────────────────────────────────────────────────────────────

export class JikanError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Jikan ${path} → ${status}`);
    this.name = "JikanError";
    this.status = status;
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Códigos 5xx de Jikan que vale la pena reintentar una vez: fallos de SU
 * servidor (timeout/sobrecarga), no del cliente — a diferencia de 429
 * (límite de tasa: reintentar de inmediato solo lo empeora) o 4xx.
 * (Confirmado por logs reales de Vercel, 2026-09-13: Jikan devolvió `504` en
 * `/top/anime`.) El User-Agent identificable lo pone `providerFetch`. */
const JIKAN_RETRYABLE_STATUS = new Set([502, 503, 504]);

async function jikanFetch<T>(
  path: string,
  params: Record<string, string> = {},
  schema?: ZodType,
  cache?: { revalidate: number },
  timeoutMs?: number
): Promise<T> {
  const url = new URL(`https://api.jikan.moe/v4${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return providerFetch<T>("jikan", url.toString(), {
    schema,
    label: path,
    retries: 1,
    retryOn: JIKAN_RETRYABLE_STATUS,
    httpError: (status) => new JikanError(path, status),
    ...(cache ? { cache } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  });
}

// ── Anime (solo lectura legacy) ──────────────────────────────────────────────

export async function getAnime(id: number): Promise<{ data: JikanAnimeDetail }> {
  return jikanFetch<{ data: JikanAnimeDetail }>(
    `/anime/${id}/full`,
    {},
    jikanDetailSchema
  );
}

export async function getAnimeVideos(id: number): Promise<JikanVideosResponse> {
  return jikanFetch<JikanVideosResponse>(
    `/anime/${id}/videos`,
    {},
    jikanVideosSchema
  );
}

// ── Manga (solo lectura legacy) ──────────────────────────────────────────────

export async function getManga(id: number): Promise<{ data: JikanMangaDetail }> {
  return jikanFetch<{ data: JikanMangaDetail }>(
    `/manga/${id}/full`,
    {},
    jikanDetailSchema
  );
}

// ── Respaldo de la búsqueda de manga (F-13) ──────────────────────────────────
//
// MangaDex no tiene algunas obras (retiradas por licencia: "Berserk",
// "Vagabond") y puede caerse. La búsqueda de manga usa entonces MyAnimeList
// vía Jikan: ids numéricos, que la ficha ya resuelve por el camino legacy
// (`resolve-item.ts`). Se cachea 24 h por consulta: Jikan es lento y su cupo
// es por segundo.

export interface JikanMangaSearchResponse {
  data: JikanManga[];
  pagination?: { last_visible_page?: number; has_next_page?: boolean };
}

const jikanMangaSearchSchema = z.looseObject({
  data: z.array(z.looseObject({ mal_id: z.number() })),
});

/** Caché de una búsqueda de respaldo en Jikan: 24 h. */
export const JIKAN_SEARCH_REVALIDATE_SECONDS = 24 * 60 * 60;

/**
 * Busca manga en MyAnimeList (Jikan `/manga?q=`), sin contenido adulto y por
 * número de miembros: entre los que contienen la consulta, la obra conocida
 * va antes que el spin-off.
 */
/**
 * Plazo cuando Jikan solo COMPLETA una búsqueda que MangaDex ya respondió:
 * más corto que el normal, para que una consulta que no es un título
 * ("romance") no espere seis segundos a MyAnimeList.
 */
export const JIKAN_SUPPLEMENT_TIMEOUT_MS = 2500;

export async function searchMangaJikan(
  query: string,
  page = 1,
  timeoutMs?: number
): Promise<JikanMangaSearchResponse> {
  return jikanFetch<JikanMangaSearchResponse>(
    "/manga",
    {
      q: query,
      sfw: "true",
      limit: "20",
      page: String(Math.max(1, page)),
      order_by: "members",
      sort: "desc",
    },
    jikanMangaSearchSchema,
    { revalidate: JIKAN_SEARCH_REVALIDATE_SECONDS },
    timeoutMs
  );
}
