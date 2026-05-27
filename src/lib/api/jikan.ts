// ============================================================
// KULTURA — Jikan API Integration
// Anime y Manga via Jikan v4 (wrapper no oficial de MyAnimeList)
// Docs: https://docs.api.jikan.moe/
// No requiere API key.
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

export interface JikanSearchResponse {
  data: (JikanAnime | JikanManga)[];
  pagination: { last_visible_page: number };
}

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

async function jikanFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://api.jikan.moe/v4${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new JikanError(path, res.status);
  return res.json() as Promise<T>;
}

// ── Anime ─────────────────────────────────────────────────────────────────────

export async function searchAnime(
  query: string,
  page = 1
): Promise<JikanSearchResponse> {
  return jikanFetch<JikanSearchResponse>("/anime", {
    q: query,
    page: String(page),
  });
}

export async function getAnime(id: number): Promise<{ data: JikanAnimeDetail }> {
  return jikanFetch<{ data: JikanAnimeDetail }>(`/anime/${id}/full`);
}

export async function getPopularAnime(
  page = 1
): Promise<JikanSearchResponse> {
  return jikanFetch<JikanSearchResponse>("/top/anime", {
    page: String(page),
  });
}

export async function getAnimeVideos(id: number): Promise<JikanVideosResponse> {
  return jikanFetch<JikanVideosResponse>(`/anime/${id}/videos`);
}

// ── Manga ─────────────────────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  page = 1
): Promise<JikanSearchResponse> {
  return jikanFetch<JikanSearchResponse>("/manga", {
    q: query,
    page: String(page),
  });
}

export async function getManga(id: number): Promise<{ data: JikanMangaDetail }> {
  return jikanFetch<{ data: JikanMangaDetail }>(`/manga/${id}/full`);
}

export async function getPopularManga(
  page = 1
): Promise<JikanSearchResponse> {
  return jikanFetch<JikanSearchResponse>("/top/manga", {
    page: String(page),
  });
}
