// ============================================================
// KULTURA — search.ts unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks — use inline values (no top-level variables in factories) ────────────

vi.mock("@/lib/api/tmdb", () => ({
  searchMovies: vi.fn().mockResolvedValue({
    results: [
      {
        id: 550,
        title: "Fight Club",
        original_title: "Fight Club",
        poster_path: null,
        backdrop_path: null,
        release_date: "1999-10-15",
        overview: "...",
        vote_average: 8.4,
        genres: [],
      },
    ],
    total_pages: 1,
    total_results: 1,
  }),
  searchTV: vi.fn().mockResolvedValue({
    results: [],
    total_pages: 1,
    total_results: 0,
  }),
}));

vi.mock("@/lib/api/jikan", () => ({
  searchAnime: vi.fn().mockResolvedValue({
    data: [
      {
        mal_id: 1,
        title: "Cowboy Bebop",
        title_english: "Cowboy Bebop",
        images: { jpg: { large_image_url: "https://example.com/cowboy.jpg" } },
        synopsis: "Space bounty hunters.",
        score: 8.9,
        genres: [{ name: "Action" }],
        year: 1998,
        episodes: 26,
        status: "Finished Airing",
        studios: [{ name: "Sunrise" }],
        source: "Original",
        trailer: { youtube_id: null },
      },
    ],
    pagination: { last_visible_page: 1 },
  }),
  searchManga: vi.fn().mockResolvedValue({
    data: [],
    pagination: { last_visible_page: 1 },
  }),
}));

vi.mock("@/lib/api/openlibrary", () => ({
  searchOpenLibrary: vi.fn().mockResolvedValue({
    docs: [
      {
        key: "/works/OL82563W",
        title: "Harry Potter",
        author_name: ["J.K. Rowling"],
        first_publish_year: 1997,
      },
    ],
    numFound: 1,
  }),
}));

vi.mock("@/lib/api/rawg", () => ({
  searchGames: vi.fn().mockResolvedValue({
    results: [
      {
        id: 3498,
        name: "Grand Theft Auto V",
        background_image: "https://example.com/gta.jpg",
        released: "2013-09-17",
        rating: 4.48,
        metacritic: 97,
        genres: [{ name: "Action" }],
      },
    ],
    count: 1,
    next: null,
  }),
}));

vi.mock("@/lib/api/comicvine", () => ({
  searchComics: vi.fn().mockResolvedValue({
    status_code: 1,
    error: "OK",
    number_of_total_results: 1,
    results: [
      {
        id: 42,
        name: "Year One",
        issue_number: "1",
        cover_date: "1987-02-01",
        store_date: null,
        deck: "Origin story",
        description: null,
        image: { medium_url: "https://example.com/cv.jpg" },
        volume: { name: "Batman" },
      },
    ],
  }),
}));

vi.mock("@/lib/api/normalizer", () => ({
  normalizeMovie: vi.fn((raw: { id: number; title: string }) => ({
    id: `movie_${raw.id}`,
    externalId: String(raw.id),
    type: "movie",
    title: raw.title,
  })),
  normalizeTV: vi.fn((raw: { id: number; name: string }) => ({
    id: `tv_${raw.id}`,
    externalId: String(raw.id),
    type: "tv",
    title: raw.name,
  })),
  normalizeAnime: vi.fn(
    (raw: { mal_id: number; title_english: string; title: string }) => ({
      id: `anime_${raw.mal_id}`,
      externalId: String(raw.mal_id),
      type: "anime",
      title: raw.title_english ?? raw.title,
    })
  ),
  normalizeMangaJikan: vi.fn((raw: { mal_id: number; title: string }) => ({
    id: `manga_${raw.mal_id}`,
    externalId: String(raw.mal_id),
    type: "manga",
    title: raw.title,
  })),
  normalizeBookOpenLibrary: vi.fn(
    (raw: { key: string; title: string }) => {
      const externalId = raw.key.replace(/^\/works\//, "");
      return {
        id: `book_${externalId}`,
        externalId,
        type: "book",
        title: raw.title,
      };
    }
  ),
  normalizeGame: vi.fn((raw: { id: number; name: string }) => ({
    id: `game_${raw.id}`,
    externalId: String(raw.id),
    type: "game",
    title: raw.name,
  })),
  normalizeComic: vi.fn((raw: { id: number; name: string }) => ({
    id: `comic_${raw.id}`,
    externalId: String(raw.id),
    type: "comic",
    title: raw.name,
  })),
}));

// ── Import subject after mocks ────────────────────────────────────────────────

import { searchAll, searchByType } from "@/lib/api/search";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("searchAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve estructura con todos los tipos", async () => {
    const results = await searchAll("test");
    expect(results).toHaveProperty("movies");
    expect(results).toHaveProperty("tv");
    expect(results).toHaveProperty("anime");
    expect(results).toHaveProperty("manga");
    expect(results).toHaveProperty("books");
    expect(results).toHaveProperty("games");
  });

  it("normaliza los resultados de cada API", async () => {
    const results = await searchAll("fight");
    expect(results.movies).toHaveLength(1);
    expect(results.movies[0]).toMatchObject({ type: "movie", title: "Fight Club" });
    expect(results.anime).toHaveLength(1);
    expect(results.anime[0]).toMatchObject({ type: "anime", title: "Cowboy Bebop" });
    expect(results.books).toHaveLength(1);
    expect(results.books[0]).toMatchObject({ type: "book", title: "Harry Potter" });
    expect(results.games).toHaveLength(1);
    expect(results.games[0]).toMatchObject({ type: "game", title: "Grand Theft Auto V" });
  });

  it("arrays vacíos para tv y manga (fixture vacío)", async () => {
    const results = await searchAll("test");
    expect(results.tv).toHaveLength(0);
    expect(results.manga).toHaveLength(0);
  });

  it("si una API rechaza → ese tipo es [] y el resto tiene datos", async () => {
    const { searchMovies } = await import("@/lib/api/tmdb");
    vi.mocked(searchMovies).mockRejectedValueOnce(new Error("TMDB down"));

    const results = await searchAll("test");
    expect(results.movies).toHaveLength(0);
    // Other types should still work
    expect(results.anime).toHaveLength(1);
    expect(results.books).toHaveLength(1);
  });

  it("si todas las APIs fallan → todos los tipos son []", async () => {
    const { searchMovies, searchTV } = await import("@/lib/api/tmdb");
    const { searchAnime, searchManga } = await import("@/lib/api/jikan");
    const { searchOpenLibrary } = await import("@/lib/api/openlibrary");
    const { searchGames } = await import("@/lib/api/rawg");

    vi.mocked(searchMovies).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(searchTV).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(searchAnime).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(searchManga).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(searchOpenLibrary).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(searchGames).mockRejectedValueOnce(new Error("fail"));

    const results = await searchAll("test");
    expect(results.movies).toHaveLength(0);
    expect(results.tv).toHaveLength(0);
    expect(results.anime).toHaveLength(0);
    expect(results.manga).toHaveLength(0);
    expect(results.books).toHaveLength(0);
    expect(results.games).toHaveLength(0);
  });
});

describe("searchByType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve solo películas cuando type='movie'", async () => {
    const results = await searchByType("fight", "movie");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("movie");
  });

  it("devuelve solo anime cuando type='anime'", async () => {
    const results = await searchByType("cowboy", "anime");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("anime");
  });

  it("devuelve solo libros cuando type='book'", async () => {
    const results = await searchByType("harry", "book");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("book");
  });

  it("type='comic' → delega en searchComics (ComicVine, server-only)", async () => {
    const { searchComics } = await import("@/lib/api/comicvine");
    const results = await searchByType("batman", "comic");
    expect(searchComics).toHaveBeenCalledWith("batman");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("comic");
  });
});
