// ============================================================
// KULTURA — discover.ts + JikanError unit tests
// Covers E29 guards: null-data, totalItems edge cases, catch 429.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { JikanError } from "@/lib/api/jikan";

// ── Mock all external API modules ─────────────────────────────────────────────

vi.mock("@/lib/api/tmdb", () => ({
  getPopularMovies: vi.fn(),
  getPopularTV: vi.fn(),
}));

vi.mock("@/lib/api/jikan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/jikan")>();
  return {
    ...actual,
    getPopularAnime: vi.fn(),
    getPopularManga: vi.fn(),
  };
});

vi.mock("@/lib/api/googlebooks", () => ({
  searchBooks: vi.fn(),
}));

vi.mock("@/lib/api/rawg", () => ({
  getPopularGames: vi.fn(),
}));

vi.mock("@/lib/api/normalizer", () => ({
  normalizeMovie: vi.fn((m) => ({ id: `movie_${m.id}`, title: m.title })),
  normalizeTV: vi.fn((tv) => ({ id: `tv_${tv.id}`, title: tv.name })),
  normalizeAnime: vi.fn((a) => ({ id: `anime_${a.mal_id}`, title: a.title })),
  normalizeMangaJikan: vi.fn((m) => ({
    id: `manga_${m.mal_id}`,
    title: m.title,
  })),
  normalizeBookGoogle: vi.fn((b) => ({
    id: `book_${b.id}`,
    title: b.volumeInfo?.title ?? "",
  })),
  normalizeGame: vi.fn((g) => ({ id: `game_${g.id}`, title: g.name })),
}));

import { fetchDiscoverData } from "@/lib/api/discover";
import { getPopularAnime, getPopularManga } from "@/lib/api/jikan";
import { searchBooks } from "@/lib/api/googlebooks";

// ── JikanError ────────────────────────────────────────────────────────────────

describe("JikanError", () => {
  it("tiene .status accesible", () => {
    const err = new JikanError("/top/anime", 429);
    expect(err.status).toBe(429);
    expect(err.name).toBe("JikanError");
    expect(err.message).toBe("Jikan /top/anime → 429");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof JikanError).toBe(true);
  });

  it("instanceof Error: true (herencia correcta)", () => {
    const err = new JikanError("/top/manga", 503);
    expect(err instanceof Error).toBe(true);
    expect(err.status).toBe(503);
  });
});

// ── Guard: res.data null/undefined en anime/manga ─────────────────────────────

describe("fetchDiscoverData — guard null-data (E29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anime: res.data = null → items=[], totalPages=1, no lanza TypeError", async () => {
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: null as unknown as never[],
      pagination: { last_visible_page: 1 },
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("anime: res.data = undefined → items=[], no lanza TypeError", async () => {
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: undefined as unknown as never[],
      pagination: { last_visible_page: 1 },
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
  });

  it("anime: res.data = array válido → items mapeados correctamente", async () => {
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: [{ mal_id: 1, title: "Naruto" }] as never[],
      pagination: { last_visible_page: 5 },
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(5);
  });

  it("manga: res.data = null → items=[], no lanza TypeError", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: null as unknown as never[],
      pagination: { last_visible_page: 1 },
    });

    const result = await fetchDiscoverData("manga", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("manga: pagination undefined → totalPages=1 (optional chaining)", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [],
      pagination: undefined as unknown as { last_visible_page: number },
    });

    const result = await fetchDiscoverData("manga", 1);
    expect(result.totalPages).toBe(1);
  });
});

// ── Guard: totalItems books ───────────────────────────────────────────────────

describe("fetchDiscoverData — guard totalItems books (E29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("totalItems = 0 → totalPages = 1", async () => {
    vi.mocked(searchBooks).mockResolvedValue({
      items: [],
      totalItems: 0,
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
    expect(result.fetchErrorKind).toBeNull();
  });

  it("totalItems = undefined → totalPages = 1", async () => {
    vi.mocked(searchBooks).mockResolvedValue({
      items: [],
      totalItems: undefined as unknown as number,
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
  });

  it("totalItems = 100 → totalPages = 5", async () => {
    vi.mocked(searchBooks).mockResolvedValue({
      items: [],
      totalItems: 100,
    });

    const result = await fetchDiscoverData("book", 1);
    // ceil(100/20) = 5, min(5, 50) = 5
    expect(result.totalPages).toBe(5);
  });

  it("totalItems = 1200 → totalPages capped a 50", async () => {
    vi.mocked(searchBooks).mockResolvedValue({
      items: [],
      totalItems: 1200,
    });

    const result = await fetchDiscoverData("book", 1);
    // ceil(1200/20) = 60, min(60, 50) = 50
    expect(result.totalPages).toBe(50);
  });
});

// ── Catch tipado: JikanError 429 vs genérico ──────────────────────────────────

describe("fetchDiscoverData — catch tipado (E29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("JikanError(429) → fetchErrorKind = 'rate-limit', items=[], totalPages=1", async () => {
    vi.mocked(getPopularAnime).mockRejectedValue(
      new JikanError("/top/anime", 429)
    );

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("rate-limit");
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("JikanError(503) → fetchErrorKind = 'generic' (no 429)", async () => {
    vi.mocked(getPopularAnime).mockRejectedValue(
      new JikanError("/top/anime", 503)
    );

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
  });

  it("Error genérico (network) → fetchErrorKind = 'generic'", async () => {
    vi.mocked(getPopularAnime).mockRejectedValue(new Error("fetch failed"));

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
  });

  it("JikanError(429) en manga → fetchErrorKind = 'rate-limit'", async () => {
    vi.mocked(getPopularManga).mockRejectedValue(
      new JikanError("/top/manga", 429)
    );

    const result = await fetchDiscoverData("manga", 1);
    expect(result.fetchErrorKind).toBe("rate-limit");
  });
});
