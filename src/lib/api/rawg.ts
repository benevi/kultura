// ============================================================
// KULTURA — RAWG API Integration
// Videojuegos via RAWG.io API
// Docs: https://api.rawg.io/docs/
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

export interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null; // "YYYY-MM-DD"
  rating: number; // 0-5 → normalizar a 0-10
  metacritic: number | null; // 0-100
  genres: { name: string }[];
  description_raw?: string;
  platforms?: { platform: { name: string } }[];
  developers?: { name: string }[];
  publishers?: { name: string }[];
}

export interface RawgResponse {
  results: RawgGame[];
  count: number;
  next: string | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function rawgFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://api.rawg.io/api${path}`);
  url.searchParams.set("key", process.env.RAWG_API_KEY!);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`RAWG ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchGames(
  query: string,
  page = 1
): Promise<RawgResponse> {
  return rawgFetch<RawgResponse>("/games", {
    search: query,
    page: String(page),
  });
}

export async function getGame(id: number): Promise<RawgGame> {
  return rawgFetch<RawgGame>(`/games/${id}`);
}

export async function getPopularGames(page = 1): Promise<RawgResponse> {
  return rawgFetch<RawgResponse>("/games", {
    ordering: "-rating",
    page: String(page),
  });
}
