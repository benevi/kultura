// ============================================================
// KULTURA — MangaDex API Integration
// Manga (fuente principal) via MangaDex API v5
// Docs: https://api.mangadex.org/docs/
// No requiere API key.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

export interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>; // { "en": "...", "ja": "..." }
    description: Record<string, string>;
    year: number | null;
    status: string;
    tags: {
      attributes: {
        name: Record<string, string>;
        group: string;
      };
    }[];
    lastChapter: string | null;
    lastVolume: string | null;
  };
  relationships: {
    type: string;
    id: string;
    attributes?: { fileName?: string };
  }[];
}

export interface MangaDexResponse {
  data: MangaDexManga[];
  total: number;
  offset: number;
}

export interface MangaDexMangaDetail {
  data: MangaDexManga;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMangaCoverUrl(mangaId: string, filename: string): string {
  return `https://uploads.mangadex.org/covers/${mangaId}/${filename}`;
}

export function extractMangaCover(manga: MangaDexManga): string | undefined {
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  if (!coverRel?.attributes?.fileName) return undefined;
  return getMangaCoverUrl(manga.id, coverRel.attributes.fileName);
}

async function mangaDexFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://api.mangadex.org${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MangaDex ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  offset = 0
): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", {
    title: query,
    offset: String(offset),
    limit: "20",
    "includes[]": "cover_art",
  });
}

export async function getManga(id: string): Promise<MangaDexMangaDetail> {
  return mangaDexFetch<MangaDexMangaDetail>(`/manga/${id}`, {
    "includes[]": "cover_art",
  });
}

export async function getPopularManga(offset = 0): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", {
    offset: String(offset),
    limit: "20",
    order: "followedCount:desc",
    "includes[]": "cover_art",
  });
}
