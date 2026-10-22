// ============================================================
// KULTURA — Jikan API Integration
// Wrapper no oficial de MyAnimeList (v4). Docs: https://docs.api.jikan.moe/
// No requiere API key.
//
// ESTADO REAL: anime se sirve con AniList (E-ANIME-SOURCE, 2026-09-13; Jikan
// sufría 504 sostenidos en producción, confirmado por logs reales) y manga
// con MangaDex (E-MANGA-SOURCE). Este módulo se conserva SOLO para resolver
// ids legacy de bibliotecas guardadas cuando anime/manga aún venían de
// Jikan — nunca se usa en Descubrir ni en búsqueda. Ver `resolveAnimeItem` /
// `resolveMangaItem` en la ficha de detalle.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

import type { ZodType } from "zod";
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
  schema?: ZodType
): Promise<T> {
  const url = new URL(`https://api.jikan.moe/v4${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return providerFetch<T>("jikan", url.toString(), {
    schema,
    label: path,
    retries: 1,
    retryOn: JIKAN_RETRYABLE_STATUS,
    httpError: (status) => new JikanError(path, status),
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
