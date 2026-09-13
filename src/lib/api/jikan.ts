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

/**
 * Identificación de la app ante Jikan (recomendado por sus propios docs).
 * No resolvió el fallo de anime en producción por sí solo — confirmado por
 * logs reales de Vercel (2026-09-13): Jikan devolvió `504` (Gateway Timeout,
 * su propio servidor, no un bloqueo de Cloudflare) en `/top/anime`. Se deja
 * el header igualmente: es inocuo y sigue siendo buena práctica.
 */
const JIKAN_HEADERS = {
  "User-Agent": "KulturaApp/1.0 (+https://kultura.app)",
  Accept: "application/json",
};

/** Códigos 5xx de Jikan que vale la pena reintentar una vez: fallos de SU
 * servidor (timeout/sobrecarga), no del cliente — a diferencia de 429
 * (límite de tasa: reintentar de inmediato solo lo empeora) o 4xx. */
const JIKAN_RETRYABLE_STATUS = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jikanFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://api.jikan.moe/v4${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(400);
    const res = await fetch(url.toString(), { headers: JIKAN_HEADERS });
    if (res.ok) return res.json() as Promise<T>;
    lastStatus = res.status;
    if (!JIKAN_RETRYABLE_STATUS.has(res.status)) break;
  }
  throw new JikanError(path, lastStatus!);
}

// ── Anime (solo lectura legacy) ──────────────────────────────────────────────

export async function getAnime(id: number): Promise<{ data: JikanAnimeDetail }> {
  return jikanFetch<{ data: JikanAnimeDetail }>(`/anime/${id}/full`);
}

export async function getAnimeVideos(id: number): Promise<JikanVideosResponse> {
  return jikanFetch<JikanVideosResponse>(`/anime/${id}/videos`);
}

// ── Manga (solo lectura legacy) ──────────────────────────────────────────────

export async function getManga(id: number): Promise<{ data: JikanMangaDetail }> {
  return jikanFetch<{ data: JikanMangaDetail }>(`/manga/${id}/full`);
}
