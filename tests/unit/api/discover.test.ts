// ============================================================
// KULTURA — discover.ts + JikanError unit tests
// Covers E29 guards: null-data, totalItems edge cases, catch 429.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { JikanError } from "@/lib/api/jikan";

// ── Mock all external API modules ─────────────────────────────────────────────

vi.mock("@/lib/api/tmdb", () => ({
  discoverMovies: vi.fn(),
  discoverTV: vi.fn(),
}));

vi.mock("@/lib/api/jikan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/jikan")>();
  return {
    ...actual,
    getPopularAnime: vi.fn(),
    getPopularManga: vi.fn(),
    discoverAnime: vi.fn(),
    discoverManga: vi.fn(),
  };
});

vi.mock("@/lib/api/openlibrary", () => ({
  searchOpenLibrary: vi.fn(),
}));

vi.mock("@/lib/api/rawg", () => ({
  getPopularGames: vi.fn(),
  discoverGames: vi.fn(),
}));

vi.mock("@/lib/api/comicvine", () => ({
  getRecentComics: vi.fn(),
}));

vi.mock("@/lib/api/normalizer", () => ({
  normalizeMovie: vi.fn((m) => ({ id: `movie_${m.id}`, title: m.title })),
  normalizeTV: vi.fn((tv) => ({ id: `tv_${tv.id}`, title: tv.name })),
  normalizeAnime: vi.fn((a) => ({ id: `anime_${a.mal_id}`, title: a.title })),
  normalizeMangaJikan: vi.fn((m) => ({
    id: `manga_${m.mal_id}`,
    title: m.title,
    metadata: { volumes: m.volumes ?? undefined },
  })),
  normalizeBookOpenLibrary: vi.fn((d) => ({
    id: `book_${String(d.key).replace(/^\/works\//, "")}`,
    title: d.title ?? "",
  })),
  normalizeGame: vi.fn((g) => ({ id: `game_${g.id}`, title: g.name })),
}));

import { fetchDiscoverData } from "@/lib/api/discover";
import { discoverMovies, discoverTV } from "@/lib/api/tmdb";
import { getPopularAnime, getPopularManga } from "@/lib/api/jikan";
import { searchOpenLibrary } from "@/lib/api/openlibrary";
import { getPopularGames, discoverGames } from "@/lib/api/rawg";
import { getRecentComics } from "@/lib/api/comicvine";

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
    // page 1 < last_visible_page 5 → hay más.
    expect(result.hasMore).toBe(true);
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

// ── Guard: numFound books (E84b — Open Library) ───────────────────────────────

describe("fetchDiscoverData — guard numFound books (E84b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("numFound = 0 → totalPages = 1", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [],
      numFound: 0,
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
    expect(result.fetchErrorKind).toBeNull();
  });

  it("numFound = undefined → totalPages = 1", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [],
      numFound: undefined as unknown as number,
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
  });

  it("numFound = 100 → totalPages = 5", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [],
      numFound: 100,
    });

    const result = await fetchDiscoverData("book", 1);
    // ceil(100/20) = 5, min(5, 50) = 5
    expect(result.totalPages).toBe(5);
  });

  it("numFound = 1200 → totalPages capped a 50", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [],
      numFound: 1200,
    });

    const result = await fetchDiscoverData("book", 1);
    // ceil(1200/20) = 60, min(60, 50) = 50
    expect(result.totalPages).toBe(50);
  });
});

// ── Books: rama con filtros vs. sin filtros (E84b — Open Library) ──────────────

describe("fetchDiscoverData — books filtros (E84b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOpenLibrary).mockResolvedValue({ docs: [], numFound: 0 });
  });

  it("sin filtros → query base (subject:fiction), sin params (paridad)", async () => {
    await fetchDiscoverData("book", 1);
    expect(searchOpenLibrary).toHaveBeenCalledWith("subject:fiction", 1);
  });

  it("con filtros → buildOpenLibraryQuery (q + params.sort), page nativa", async () => {
    await fetchDiscoverData("book", 2, {
      genre: ["fantasia"],
      editorial: ["planeta"],
      formato: "free",
      idioma: "en",
      year: "2020",
      sort: "release_desc",
    });
    // Open Library pagina por page (1-based), no startIndex.
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      "subject:Fantasy publisher:Planeta language:eng first_publish_year:[2020 TO 2020] ebook_access:public",
      2,
      { sort: "new" }
    );
  });

  it("solo editorial → dispara rama nativa (ya no es post-filtro)", async () => {
    await fetchDiscoverData("book", 1, { editorial: ["planeta"] });
    expect(searchOpenLibrary).toHaveBeenCalledWith("publisher:Planeta", 1, {});
  });
});

// ── Manga: post-filtro volúmenes (E59 F3c) ────────────────────────────────────

describe("fetchDiscoverData — manga volúmenes post-filtro (E59 F3c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Lote con volumes variados, incluido null (sin resolver).
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [
        { mal_id: 1, title: "Corto", volumes: 3 },
        { mal_id: 2, title: "Medio", volumes: 10 },
        { mal_id: 3, title: "Largo", volumes: 30 },
        { mal_id: 4, title: "Sin resolver", volumes: null },
      ] as never[],
      pagination: { last_visible_page: 1 },
    });
  });

  it("volumenes='6-20' → descarta < 6 y volumes null", async () => {
    const result = await fetchDiscoverData("manga", 1, { volumenes: "6-20" });
    const ids = result.items.map((i) => i.id);
    expect(ids).toEqual(["manga_2", "manga_3"]); // 10 y 30 ≥ 6; 3 y null fuera
  });

  it("volumenes='20plus' → solo >= 20", async () => {
    const result = await fetchDiscoverData("manga", 1, { volumenes: "20plus" });
    expect(result.items.map((i) => i.id)).toEqual(["manga_3"]);
  });

  it("volumenes='1-5' → >= 1 (descarta solo el de volumes null)", async () => {
    const result = await fetchDiscoverData("manga", 1, { volumenes: "1-5" });
    expect(result.items.map((i) => i.id)).toEqual([
      "manga_1",
      "manga_2",
      "manga_3",
    ]);
  });

  it("sin volumenes → no filtra (paridad, incluye volumes null)", async () => {
    const result = await fetchDiscoverData("manga", 1);
    expect(result.items).toHaveLength(4);
  });

  it("bucket desconocido → no filtra", async () => {
    const result = await fetchDiscoverData("manga", 1, {
      volumenes: "zzz",
    } as Parameters<typeof fetchDiscoverData>[2]);
    expect(result.items).toHaveLength(4);
  });
});

// ── Anime: volúmenes IGNORADO (oculto para anime) (E59 F3c) ────────────────────

describe("fetchDiscoverData — anime ignora volúmenes (E59 F3c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: [
        { mal_id: 1, title: "A" },
        { mal_id: 2, title: "B" },
      ] as never[],
      pagination: { last_visible_page: 1 },
    });
  });

  it("volumenes set en anime → NO filtra (no aplica a anime)", async () => {
    const result = await fetchDiscoverData("anime", 1, {
      volumenes: "20plus",
    });
    expect(result.items).toHaveLength(2);
  });
});

// ── Comic: rama con filtros vs. sin filtros (E59 F3c) ──────────────────────────

describe("fetchDiscoverData — comic filtros (E59 F3c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecentComics).mockResolvedValue({ items: [], total: 0 });
  });

  it("sin filtros → getRecentComics(page) (paridad, sin filters)", async () => {
    await fetchDiscoverData("comic", 3);
    expect(getRecentComics).toHaveBeenCalledWith(3);
  });

  it("con filtros (sort/year/editorial) → getRecentComics(page, filters)", async () => {
    const filters = {
      sort: "release_asc",
      year: "2020",
      editorial: ["marvel"],
    };
    await fetchDiscoverData("comic", 2, filters);
    expect(getRecentComics).toHaveBeenCalledWith(2, filters);
  });

  it("solo sort default (popularity → cover_date:desc) NO dispara filtros", async () => {
    await fetchDiscoverData("comic", 1, { sort: "popularity" });
    expect(getRecentComics).toHaveBeenCalledWith(1);
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

// ── E59 R5a: modo "all" (delegación a aggregate, end-to-end) ──────────────────
// Aquí NO mockeamos aggregate.ts: ejercitamos el agregado REAL contra los mocks
// de las APIs externas, validando el cableado case "all" → fetchAggregateData →
// fan-out por familia. Sustituye al curl manual contra /api/discover?type=all.

describe('fetchDiscoverData — modo "all" (R5a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Configura las 7 familias con respuestas mínimas válidas. */
  function setupAllFamilies() {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "Movie A" }],
      total_pages: 1,
    } as never);
    vi.mocked(discoverTV).mockResolvedValue({
      results: [{ id: 2, name: "TV B" }],
      total_pages: 1,
    } as never);
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: [{ mal_id: 3, title: "Anime C" }] as never[],
      pagination: { last_visible_page: 1 },
    });
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [{ key: "/works/b4", title: "Book D" }],
      numFound: 1,
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [{ mal_id: 5, title: "Manga E" }] as never[],
      pagination: { last_visible_page: 1 },
    });
    // sort=popularity gatea hasRawgFilters → game usa discoverGames; mockeamos
    // ambas rutas por robustez (getPopularGames para el caso sin sort).
    const gameRes = { results: [{ id: 6, name: "Game F" }], count: 1 } as never;
    vi.mocked(getPopularGames).mockResolvedValue(gameRes);
    vi.mocked(discoverGames).mockResolvedValue(gameRes);
    vi.mocked(getRecentComics).mockResolvedValue({
      items: [{ id: "comic_7", title: "Comic G" }] as never[],
      total: 1,
    } as never);
  }

  it("delega: fan-out a las 7 familias y agrega sus items (interleave popularity)", async () => {
    setupAllFamilies();
    const result = await fetchDiscoverData("all", 1, { sort: "popularity" });

    expect(result.fetchErrorKind).toBeNull();
    // 1 item por familia → 7 ítems en orden de FAMILIES (movie,tv,anime,book,
    // manga,game,comic).
    expect(result.items.map((i) => i.id)).toEqual([
      "movie_1",
      "tv_2",
      "anime_3",
      "book_b4",
      "manga_5",
      "game_6",
      "comic_7",
    ]);
    expect(result.totalPages).toBe(1);
  });

  it("parcial-ok: una familia que lanza no rompe el agregado (resto presente)", async () => {
    setupAllFamilies();
    // sort=popularity → game va por discoverGames; lo hacemos fallar.
    vi.mocked(discoverGames).mockRejectedValue(new Error("rawg down"));

    const result = await fetchDiscoverData("all", 1, { sort: "popularity" });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain("movie_1");
    expect(ids).not.toContain("game_6"); // game cayó
    expect(result.fetchErrorKind).toBeNull(); // hay items → null
  });

  it("0 items + rate-limit en una familia → fetchErrorKind 'rate-limit'", async () => {
    // Todas vacías; anime rate-limit (JikanError 429).
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [],
      total_pages: 1,
    } as never);
    vi.mocked(discoverTV).mockResolvedValue({
      results: [],
      total_pages: 1,
    } as never);
    vi.mocked(getPopularAnime).mockRejectedValue(
      new JikanError("/top/anime", 429)
    );
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [],
      numFound: 0,
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [] as never[],
      pagination: { last_visible_page: 1 },
    });
    vi.mocked(getPopularGames).mockResolvedValue({
      results: [],
      count: 0,
    } as never);
    vi.mocked(getRecentComics).mockResolvedValue({
      items: [] as never[],
      total: 0,
    } as never);

    const result = await fetchDiscoverData("all", 1, {});
    expect(result.items).toEqual([]);
    expect(result.fetchErrorKind).toBe("rate-limit");
  });
});

// ── E79 slice 1: hasMore por familia (gate de "next" = fuente cruda) ───────────
// hasMore = page < providerTotalPages. El post-filtro recorta items pero NO
// cambia si hay más fuente que paginar → no provoca páginas cortas/vacías que
// deshabiliten "next" antes de tiempo.

describe("fetchDiscoverData — hasMore (E79 slice 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("movie: page < total_pages → hasMore true; última página → false", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 3,
    } as never);

    expect((await fetchDiscoverData("movie", 1)).hasMore).toBe(true);
    expect((await fetchDiscoverData("movie", 3)).hasMore).toBe(false);
    expect((await fetchDiscoverData("movie", 4)).hasMore).toBe(false);
  });

  it("tv: hasMore desde total_pages del proveedor", async () => {
    vi.mocked(discoverTV).mockResolvedValue({
      results: [{ id: 2, name: "T" }],
      total_pages: 2,
    } as never);

    expect((await fetchDiscoverData("tv", 1)).hasMore).toBe(true);
    expect((await fetchDiscoverData("tv", 2)).hasMore).toBe(false);
  });

  it("anime: hasMore desde last_visible_page", async () => {
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: [{ mal_id: 1, title: "A" }] as never[],
      pagination: { last_visible_page: 4 },
    });

    expect((await fetchDiscoverData("anime", 3)).hasMore).toBe(true);
    expect((await fetchDiscoverData("anime", 4)).hasMore).toBe(false);
  });

  it("manga: hasMore desde last_visible_page", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [{ mal_id: 1, title: "M" }] as never[],
      pagination: { last_visible_page: 2 },
    });

    expect((await fetchDiscoverData("manga", 1)).hasMore).toBe(true);
    expect((await fetchDiscoverData("manga", 2)).hasMore).toBe(false);
  });

  it("book: hasMore desde ceil(numFound/20) capado a 50", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: [{ key: "/works/1", title: "B" }],
      numFound: 60, // ceil(60/20)=3
    } as never);

    expect((await fetchDiscoverData("book", 2)).hasMore).toBe(true);
    expect((await fetchDiscoverData("book", 3)).hasMore).toBe(false);
  });

  it("comic: hasMore desde ceil(total/20)", async () => {
    vi.mocked(getRecentComics).mockResolvedValue({
      items: [{ id: "comic_1", title: "C" }] as never[],
      total: 50, // ceil(50/20)=3
    } as never);

    expect((await fetchDiscoverData("comic", 2)).hasMore).toBe(true);
    expect((await fetchDiscoverData("comic", 3)).hasMore).toBe(false);
  });

  it("game: hasMore desde ceil(count/20)", async () => {
    vi.mocked(getPopularGames).mockResolvedValue({
      results: [{ id: 1, name: "G" }],
      count: 40, // ceil(40/20)=2
    } as never);

    expect((await fetchDiscoverData("game", 1)).hasMore).toBe(true);
    expect((await fetchDiscoverData("game", 2)).hasMore).toBe(false);
  });

  it("CASO CLAVE: hasMore se computa sobre la fuente cruda (count), no sobre items servidos", async () => {
    // El gate de "next" lo decide la FUENTE (count → 10 páginas), no cuántos
    // items sobreviven al post-filtro de esta página. Aunque un post-filtro
    // recortara la página a 0, hasMore seguiría true porque la fuente tiene más.
    // (Verificación E2E del render con página vacía + next activo:
    //  discover-pagination.spec.ts → "página filtrada vacía no bloquea next".)
    vi.mocked(getPopularGames).mockResolvedValue({
      results: [{ id: 1, name: "G" }],
      count: 200, // ceil(200/20)=10 páginas de fuente
    } as never);

    const p1 = await fetchDiscoverData("game", 1, {});
    expect(p1.hasMore).toBe(true); // page 1 < 10
    const p10 = await fetchDiscoverData("game", 10, {});
    expect(p10.hasMore).toBe(false); // última página de la fuente
  });

  it("error (catch) → hasMore false (no hay siguiente que ofrecer)", async () => {
    vi.mocked(getPopularAnime).mockRejectedValue(new Error("boom"));
    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
    expect(result.hasMore).toBe(false);
  });
});

// ── E79 slice 1: hasMore en agregado "all" ────────────────────────────────────

describe('fetchDiscoverData — hasMore en "all" (E79 slice 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hasMore true si el pool merged excede page*20; false al agotarlo", async () => {
    // Cada familia devuelve 5 items → pool de 35 (7 familias). page 1 sirve 20,
    // quedan 15 → hasMore true. page 2 sirve los 15 restantes → hasMore false.
    const five = (mk: (i: number) => unknown) =>
      Array.from({ length: 5 }, (_, i) => mk(i));
    vi.mocked(discoverMovies).mockResolvedValue({
      results: five((i) => ({ id: `m${i}`, title: "M" })),
      total_pages: 1,
    } as never);
    vi.mocked(discoverTV).mockResolvedValue({
      results: five((i) => ({ id: `t${i}`, name: "T" })),
      total_pages: 1,
    } as never);
    vi.mocked(getPopularAnime).mockResolvedValue({
      data: five((i) => ({ mal_id: `a${i}`, title: "A" })) as never[],
      pagination: { last_visible_page: 1 },
    });
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      docs: five((i) => ({ key: `/works/b${i}`, title: "B" })),
      numFound: 5,
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: five((i) => ({ mal_id: `g${i}`, title: "G" })) as never[],
      pagination: { last_visible_page: 1 },
    });
    const gameRes = {
      results: five((i) => ({ id: `v${i}`, name: "V" })),
      count: 5,
    } as never;
    vi.mocked(getPopularGames).mockResolvedValue(gameRes);
    vi.mocked(discoverGames).mockResolvedValue(gameRes);
    vi.mocked(getRecentComics).mockResolvedValue({
      items: five((i) => ({ id: `comic_${i}`, title: "C" })) as never[],
      total: 5,
    } as never);

    const p1 = await fetchDiscoverData("all", 1, {});
    expect(p1.items).toHaveLength(20);
    expect(p1.hasMore).toBe(true); // 20 < 35

    const p2 = await fetchDiscoverData("all", 2, {});
    expect(p2.items).toHaveLength(15);
    expect(p2.hasMore).toBe(false); // 40 >= 35
  });
});
