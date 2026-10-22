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

// E-ANIME-SOURCE: anime se busca en AniList (no Jikan).
vi.mock("@/lib/api/anilist", () => ({
  searchAnime: vi.fn().mockResolvedValue({
    media: [
      {
        id: 1,
        title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop", native: null },
        coverImage: { extraLarge: "https://example.com/cowboy.jpg", large: null },
        description: "Space bounty hunters.",
        genres: ["Action"],
        averageScore: 89,
        seasonYear: 1998,
        startDate: { year: 1998 },
        episodes: 26,
        status: "FINISHED",
        studios: { nodes: [{ name: "Sunrise" }] },
        trailer: null,
        source: "ORIGINAL",
      },
    ],
    pageInfo: { currentPage: 1, lastPage: 1, hasNextPage: false, total: 1 },
  }),
}));

// E-MANGA-SOURCE: manga se busca en MangaDex (no Jikan). F-13: con nota de
// `/statistics/manga` y título oficial (helpers puros: los reales).
vi.mock("@/lib/api/mangadex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/mangadex")>();
  return {
    ...actual,
    searchManga: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      offset: 0,
    }),
    getMangaStatistics: vi.fn().mockResolvedValue(new Map()),
  };
});

// F-13: respaldo de manga (MyAnimeList vía Jikan).
vi.mock("@/lib/api/jikan", () => ({
  searchMangaJikan: vi.fn().mockResolvedValue({ data: [] }),
}));

// F-13: respaldo de cómic (novela gráfica de Google Books).
vi.mock("@/lib/api/googlebooks", () => ({
  searchComicsGoogleBooks: vi.fn().mockResolvedValue({ totalItems: 0, items: [] }),
}));

// E-BOOKS-HIBRIDO: el buscador de libros va contra el MISMO proveedor que el
// catálogo (Open Library), para que buscar y navegar no sean dos mundos
// distintos. Solo se mockea la llamada de red; `openLibraryTotalPages` (helper
// puro que usa searchByTypePaged) es el real.
vi.mock("@/lib/api/openlibrary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/openlibrary")>();
  return {
    ...actual,
    searchOpenLibrary: vi.fn().mockResolvedValue({
      numFound: 1,
      docs: [
        {
          key: "/works/OL82563W",
          title: "Harry Potter",
          author_name: ["J.K. Rowling"],
          first_publish_year: 1997,
        },
      ],
    }),
  };
});

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

// F-13 (DAT-6): el cómic se busca por SERIES (`searchComicVolumes`), ya
// normalizadas por comicvine.ts.
vi.mock("@/lib/api/comicvine", () => ({
  COMIC_SEARCH_PAGE_SIZE: 10,
  searchComicVolumes: vi.fn().mockResolvedValue({
    total: 1,
    items: [
      {
        id: "comic_6036",
        externalId: "6036",
        type: "comic",
        title: "Batman",
        poster: "https://example.com/cv.jpg",
        metadata: { issues: 713 },
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
  normalizeAniListAnime: vi.fn(
    (raw: { id: number; title: { english: string | null; romaji: string | null } }) => ({
      id: `anime_al-${raw.id}`,
      externalId: `al-${raw.id}`,
      type: "anime",
      title: raw.title.english ?? raw.title.romaji,
    })
  ),
  normalizeMangaDex: vi.fn((raw: { id: string; title: string }) => ({
    id: `manga_${raw.id}`,
    externalId: raw.id,
    type: "manga",
    title: raw.title,
  })),
  normalizeMangaJikan: vi.fn((raw: { mal_id: number; title: string }) => ({
    id: `manga_${raw.mal_id}`,
    externalId: String(raw.mal_id),
    type: "manga",
    title: raw.title,
  })),
  normalizeBookGoogle: vi.fn((raw: { id: string; volumeInfo?: { title?: string } }) => ({
    id: `book_${raw.id}`,
    externalId: raw.id,
    type: "book",
    title: raw.volumeInfo?.title ?? "",
  })),
  // E-BOOKS-HIBRIDO: la búsqueda de libros usa Open Library, igual que el
  // catálogo. Google Books solo entra en la ficha.
  normalizeBookOpenLibrary: vi.fn((raw: { key: string; title?: string }) => {
    const externalId = raw.key.replace(/^\/works\//, "");
    return {
      id: `book_${externalId}`,
      externalId,
      type: "book",
      title: raw.title ?? "",
    };
  }),
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

import { searchByType, searchByTypePaged } from "@/lib/api/search";

// ── Tests ─────────────────────────────────────────────────────────────────────

// E-DISCOVER-SEARCH-MERGE: `searchAll` se eliminó (su único consumidor era la
// página /search, hoy un redirect a /discover). El agregado de búsqueda vive en
// `fetchAggregateSearch` y se apoya en `searchByTypePaged`, que es lo que se
// testea aquí: forma paginada `{items, totalPages, hasMore}` por familia.

describe("searchByTypePaged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("movie: totalPages desde total_pages de TMDB y hasMore por posición", async () => {
    const { searchMovies } = await import("@/lib/api/tmdb");
    vi.mocked(searchMovies).mockResolvedValue({
      results: [{ id: 550, title: "Fight Club" }],
      total_pages: 3,
      total_results: 60,
    } as never); // se llama dos veces en este test (página 1 y última)

    const first = await searchByTypePaged("fight", "movie", 1);
    expect(first.items).toHaveLength(1);
    expect(first.totalPages).toBe(3);
    expect(first.hasMore).toBe(true);

    const last = await searchByTypePaged("fight", "movie", 3);
    expect(last.hasMore).toBe(false);
  });

  it("movie: propaga page y locale al proveedor", async () => {
    const { searchMovies } = await import("@/lib/api/tmdb");
    await searchByTypePaged("fight", "movie", 4, "en");
    expect(searchMovies).toHaveBeenCalledWith("fight", 4, "en");
  });

  it("anime: totalPages desde pageInfo.lastPage (AniList, E-ANIME-SOURCE)", async () => {
    const { searchAnime } = await import("@/lib/api/anilist");
    vi.mocked(searchAnime).mockResolvedValueOnce({
      media: [{ id: 1, title: { english: "Cowboy Bebop", romaji: null } }],
      pageInfo: { currentPage: 2, lastPage: 7, hasNextPage: true, total: 140 },
    } as never);

    const res = await searchByTypePaged("cowboy", "anime", 2);
    expect(res.totalPages).toBe(7);
    expect(res.hasMore).toBe(true);
    expect(searchAnime).toHaveBeenCalledWith("cowboy", 2);
  });

  it("manga: totalPages desde total de MangaDex, paginado por offset (E-MANGA-SOURCE)", async () => {
    const { searchManga } = await import("@/lib/api/mangadex");
    vi.mocked(searchManga).mockResolvedValueOnce({
      data: [{ id: "uuid-1", title: "One Piece", attributes: { title: { en: "One Piece" }, altTitles: [], tags: [] } }],
      total: 45, // ceil(45/20) = 3
      offset: 20,
    } as never);

    const res = await searchByTypePaged("one piece", "manga", 2, "es");
    expect(res.totalPages).toBe(3);
    expect(res.hasMore).toBe(true);
    // page 2 → offset (2-1)*20 = 20.
    expect(searchManga).toHaveBeenCalledWith("one piece", 20, "es");
  });

  it("book: totalPages desde el numFound REAL de Open Library", async () => {
    const { searchOpenLibrary } = await import("@/lib/api/openlibrary");
    vi.mocked(searchOpenLibrary).mockResolvedValueOnce({
      numFound: 45,
      docs: [{ key: "/works/OL1W", title: "Harry Potter" }],
    } as never);

    const res = await searchByTypePaged("harry", "book", 2, "es");
    expect(res.totalPages).toBe(3); // ceil(45/20)
    expect(res.hasMore).toBe(true);
    // El buscador NO acota por idioma: un título concreto debe encontrarse
    // aunque solo exista la edición original.
    expect(searchOpenLibrary).toHaveBeenCalledWith("harry", 2);
  });

  it("game: totalPages desde count de RAWG", async () => {
    const { searchGames } = await import("@/lib/api/rawg");
    vi.mocked(searchGames).mockResolvedValueOnce({
      results: [{ id: 3498, name: "GTA V", rating: 4 }],
      count: 25,
      next: null,
    } as never);

    const res = await searchByTypePaged("gta", "game", 1);
    expect(res.totalPages).toBe(2);
    expect(searchGames).toHaveBeenCalledWith("gta", 1);
  });

  it("comic: busca SERIES, 10 por página, con el total de ComicVine (DAT-6)", async () => {
    const { searchComicVolumes } = await import("@/lib/api/comicvine");
    vi.mocked(searchComicVolumes).mockResolvedValueOnce({
      items: [{ id: "comic_1", externalId: "1", type: "comic", title: "Batman", poster: "p" }],
      total: 40,
    } as never);

    const res = await searchByTypePaged("batman", "comic", 2);
    expect(res.totalPages).toBe(4);
    expect(res.hasMore).toBe(true);
    expect(searchComicVolumes).toHaveBeenCalledWith("batman", 2);
  });

  it("respuesta sin resultados → items vacío, 1 página, sin siguiente", async () => {
    const { searchOpenLibrary } = await import("@/lib/api/openlibrary");
    vi.mocked(searchOpenLibrary).mockResolvedValueOnce({
      numFound: 0,
      docs: [],
    } as never);

    const res = await searchByTypePaged("zzzz", "book", 1);
    expect(res.items).toEqual([]);
    expect(res.totalPages).toBe(1);
    expect(res.hasMore).toBe(false);
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

  it("devuelve solo manga cuando type='manga' (MangaDex, E-MANGA-SOURCE)", async () => {
    const { searchManga } = await import("@/lib/api/mangadex");
    vi.mocked(searchManga).mockResolvedValueOnce({
      data: [{ id: "uuid-1", title: "One Piece", attributes: { title: { en: "One Piece" }, altTitles: [], tags: [] } }],
      total: 1,
      offset: 0,
    } as never);

    const results = await searchByType("one piece", "manga");
    expect(searchManga).toHaveBeenCalledWith("one piece", 0, undefined);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("manga");
  });

  it("devuelve solo libros cuando type='book'", async () => {
    const results = await searchByType("harry", "book");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("book");
  });

  it("type='comic' → delega en searchComicVolumes (ComicVine, server-only)", async () => {
    const { searchComicVolumes } = await import("@/lib/api/comicvine");
    const results = await searchByType("batman", "comic");
    expect(searchComicVolumes).toHaveBeenCalledWith("batman", 1);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("comic");
  });
});

// ── E-ANIME-RESPALDO: AniList caído → buscador de anime en TMDB ──────────────

describe("searchByTypePaged — respaldo de anime (E-ANIME-RESPALDO)", () => {
  it("si AniList falla, devuelve solo animación japonesa de TMDB", async () => {
    const { searchAnime } = await import("@/lib/api/anilist");
    const { searchTV } = await import("@/lib/api/tmdb");
    vi.mocked(searchAnime).mockRejectedValueOnce(new Error("AniList → 403"));
    vi.mocked(searchTV).mockResolvedValueOnce({
      results: [
        { id: 5, name: "Bebop", genre_ids: [16], origin_country: ["JP"], poster_path: null, first_air_date: "1998-04-03", overview: "", vote_average: 8.8, original_name: "Bebop", backdrop_path: null },
        { id: 6, name: "Drama US", genre_ids: [18], origin_country: ["US"], poster_path: null, first_air_date: "2020-01-01", overview: "", vote_average: 7, original_name: "Drama US", backdrop_path: null },
      ],
      total_pages: 1,
      total_results: 2,
    } as never);

    const r = await searchByTypePaged("bebop", "anime", 1, "es");
    expect(r.items.map((i) => i.id)).toEqual(["anime_tmdb-5"]);
    expect(r.items[0].type).toBe("anime");
  });
});
