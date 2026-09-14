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

// E-ANIME-SOURCE: anime se sirve con AniList (no Jikan).
vi.mock("@/lib/api/anilist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/anilist")>();
  return {
    ...actual,
    discoverAnime: vi.fn(),
  };
});

// E-MANGA-SOURCE: manga se sirve con MangaDex (no Jikan).
vi.mock("@/lib/api/mangadex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/mangadex")>();
  return {
    ...actual,
    getPopularManga: vi.fn(),
    discoverManga: vi.fn(),
  };
});

// E-DISCOVER-SEARCH-MERGE: la rama de búsqueda delega en el buscador por familia.
vi.mock("@/lib/api/search", () => ({
  searchByTypePaged: vi.fn(),
}));

vi.mock("@/lib/api/openlibrary", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/openlibrary")>();
  // E-BOOKS-HIBRIDO: el catálogo de libros lo sirve Open Library.
  return { ...actual, searchOpenLibrary: vi.fn() };
});

vi.mock("@/lib/api/googlebooks", async (importOriginal) => {
  // E-BOOKS-GOOGLE: solo se mockea la llamada de red; los helpers puros
  // (totalPages/startIndex/cover) son los reales.
  const actual =
    await importOriginal<typeof import("@/lib/api/googlebooks")>();
  return { ...actual, searchGoogleBooks: vi.fn() };
});

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
  normalizeAniListAnime: vi.fn((a) => ({ id: `anime_${a.id}`, title: a.title })),
  normalizeMangaDex: vi.fn((m) => ({
    id: `manga_${m.id}`,
    title: m.title,
    metadata: { volumes: m.volumes ?? undefined },
  })),
  // E-BOOKS-HIBRIDO: el catálogo de libros viene de Open Library; Google Books
  // solo entra en la FICHA, así que su normalizador ya no se ejerce aquí.
  normalizeBookOpenLibrary: vi.fn((d) => ({
    id: `book_${String(d.key).replace(/^\/works\//, "")}`,
    title: d.title ?? "",
    year: d.first_publish_year,
  })),
  normalizeGame: vi.fn((g) => ({ id: `game_${g.id}`, title: g.name })),
}));

import { fetchDiscoverData } from "@/lib/api/discover";
import { discoverMovies, discoverTV } from "@/lib/api/tmdb";
import { discoverAnime, AniListError } from "@/lib/api/anilist";
import { getPopularManga } from "@/lib/api/mangadex";
import { searchGoogleBooks } from "@/lib/api/googlebooks";
import { searchOpenLibrary } from "@/lib/api/openlibrary";
import { searchByTypePaged } from "@/lib/api/search";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";
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

  it("anime: res.media = null → items=[], totalPages=1, no lanza TypeError", async () => {
    vi.mocked(discoverAnime).mockResolvedValue({
      media: null as unknown as never[],
      pageInfo: { lastPage: 1 } as never,
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("anime: res.media = undefined → items=[], no lanza TypeError", async () => {
    vi.mocked(discoverAnime).mockResolvedValue({
      media: undefined as unknown as never[],
      pageInfo: { lastPage: 1 } as never,
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
  });

  it("anime: res.media = array válido → items mapeados correctamente", async () => {
    vi.mocked(discoverAnime).mockResolvedValue({
      media: [{ id: 1, title: "Naruto" }] as never[],
      pageInfo: { lastPage: 5 } as never,
    });

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(5);
    // page 1 < lastPage 5 → hay más.
    expect(result.hasMore).toBe(true);
  });

  it("manga: res.data = null → items=[], no lanza TypeError", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: null as unknown as never[],
      total: 0,
      offset: 0,
    });

    const result = await fetchDiscoverData("manga", 1);
    expect(result.fetchErrorKind).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("manga: total undefined → totalPages=1 (optional chaining)", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [],
      total: undefined as unknown as number,
      offset: 0,
    });

    const result = await fetchDiscoverData("manga", 1);
    expect(result.totalPages).toBe(1);
  });
});

// ── Guard: totalItems books (E-BOOKS-GOOGLE — Google Books) ──────────────────

describe("fetchDiscoverData — guard totalItems books (E-BOOKS-GOOGLE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("totalItems = 0 → totalPages = 1", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({ numFound: 0, docs: [] });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
    expect(result.fetchErrorKind).toBeNull();
  });

  it("docs ausente → sin items, sin error", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({ numFound: 0, docs: [] });

    const result = await fetchDiscoverData("book", 1);
    expect(result.items).toEqual([]);
    expect(result.fetchErrorKind).toBeNull();
  });

  it("numFound = undefined → totalPages = 1", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: undefined as unknown as number,
      docs: [],
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(1);
  });

  it("numFound = 100 → totalPages = 5", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 100,
      docs: [],
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(5);
  });

  it("numFound enorme → totalPages capado al tope común (E79-s3)", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 1_000_000,
      docs: [],
    });

    const result = await fetchDiscoverData("book", 1);
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
  });
});

// ── Books: rama con filtros vs. sin filtros (E-BOOKS-GOOGLE) ─────────────────

describe("fetchDiscoverData — books filtros (E-BOOKS-HIBRIDO)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOpenLibrary).mockResolvedValue({ numFound: 0, docs: [] });
  });

  it("sin filtros → semilla amplia y el idioma del locale", async () => {
    await fetchDiscoverData("book", 1);
    expect(searchOpenLibrary).toHaveBeenCalledWith('subject:"fiction"', 1, {
      language: "spa",
    });
  });

  // Lo que Google Books no sabía hacer: género, año y orden en la propia
  // consulta, aplicados por el proveedor y no a mano sobre lo ya recibido.
  it("género, año y orden viajan en la consulta, no como post-filtro", async () => {
    await fetchDiscoverData(
      "book",
      2,
      { genre: ["fantasia"], year: "2024", sort: "release_desc" },
      "en"
    );
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      'subject:"fantasy" first_publish_year:[2024 TO 2024]',
      2,
      { language: "eng", sort: "new" }
    );
  });

  it("una década es un rango, no un año suelto ignorado", async () => {
    await fetchDiscoverData("book", 1, { year: "2000s" });
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      "first_publish_year:[2000 TO 2009]",
      1,
      { language: "spa" }
    );
  });

  it("classic cubre 1900-1999, igual que en el resto de familias", async () => {
    await fetchDiscoverData("book", 1, { year: "classic" });
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      "first_publish_year:[1900 TO 1999]",
      1,
      { language: "spa" }
    );
  });

  it("el idioma del locale viaja SIEMPRE: es lo que fija el título que se lee", async () => {
    await fetchDiscoverData("book", 1, {}, "es");
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      'subject:"fiction"',
      1,
      expect.objectContaining({ language: "spa" })
    );
  });

  it('formato "libre" acota a texto completo; el resto no finge precisión', async () => {
    await fetchDiscoverData("book", 1, { formato: "free" });
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      'subject:"fiction"',
      1,
      expect.objectContaining({ has_fulltext: "true" })
    );

    vi.mocked(searchOpenLibrary).mockClear();
    await fetchDiscoverData("book", 1, { formato: "physical" });
    expect(searchOpenLibrary).toHaveBeenCalledWith(
      'subject:"fiction"',
      1,
      expect.not.objectContaining({ has_fulltext: expect.anything() })
    );
  });

  // Con Google Books el año era post-filtro y obligaba a ocultar la última
  // página porque el conteo mentía. Open Library lo aplica de verdad.
  it("año activo → el conteo sigue siendo fiable, totalPages NO es null", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 60,
      docs: [
        {
          key: "/works/OL1W",
          title: "Del 2003",
          first_publish_year: 2003,
        },
      ],
    } as never);

    const result = await fetchDiscoverData("book", 1, { year: "2003" });
    expect(result.items.map((i) => i.title)).toEqual(["Del 2003"]);
    expect(result.totalPages).toBe(3);
  });
});

// ── Manga: post-filtro volúmenes (E59 F3c) ────────────────────────────────────

describe("fetchDiscoverData — manga volúmenes post-filtro (E59 F3c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Lote con volumes variados, incluido null (sin resolver).
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [
        { id: "1", title: "Corto", volumes: 3 },
        { id: "2", title: "Medio", volumes: 10 },
        { id: "3", title: "Largo", volumes: 30 },
        { id: "4", title: "Sin resolver", volumes: null },
      ] as never[],
      total: 4,
      offset: 0,
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
    vi.mocked(discoverAnime).mockResolvedValue({
      media: [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
      ] as never[],
      pageInfo: { lastPage: 1 } as never,
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

// ── Catch tipado: AniListError/JikanError 429 vs genérico ─────────────────────

describe("fetchDiscoverData — catch tipado (E29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AniListError(429) → fetchErrorKind = 'rate-limit', items=[], totalPages=1", async () => {
    vi.mocked(discoverAnime).mockRejectedValue(
      new AniListError("rate limited", 429)
    );

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("rate-limit");
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("AniListError(503) → fetchErrorKind = 'generic' (no 429)", async () => {
    vi.mocked(discoverAnime).mockRejectedValue(
      new AniListError("down", 503)
    );

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
  });

  it("Error genérico (network) → fetchErrorKind = 'generic'", async () => {
    vi.mocked(discoverAnime).mockRejectedValue(new Error("fetch failed"));

    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
  });

  it("error de red en manga (MangaDex) → fetchErrorKind = 'generic' (no es JikanError)", async () => {
    // E-MANGA-SOURCE: manga ya no pasa por Jikan → sus fallos nunca son
    // JikanError, así que nunca se clasifican como 'rate-limit'.
    vi.mocked(getPopularManga).mockRejectedValue(
      new Error("MangaDex /manga → 429")
    );

    const result = await fetchDiscoverData("manga", 1);
    expect(result.fetchErrorKind).toBe("generic");
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
    vi.mocked(discoverAnime).mockResolvedValue({
      media: [{ id: 3, title: "Anime C" }] as never[],
      pageInfo: { lastPage: 1 } as never,
    });
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 1,
      docs: [{ key: "/works/OL4W", title: "Book D" }],
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [{ id: "5", title: "Manga E" }] as never[],
      total: 1,
      offset: 0,
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
      "book_OL4W",
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
    // Todas vacías; anime rate-limit (AniListError 429).
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [],
      total_pages: 1,
    } as never);
    vi.mocked(discoverTV).mockResolvedValue({
      results: [],
      total_pages: 1,
    } as never);
    vi.mocked(discoverAnime).mockRejectedValue(
      new AniListError("rate limited", 429)
    );
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      totalItems: 0,
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [] as never[],
      total: 0,
      offset: 0,
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

  it("anime: hasMore desde pageInfo.lastPage (AniList)", async () => {
    vi.mocked(discoverAnime).mockResolvedValue({
      media: [{ id: 1, title: "A" }] as never[],
      pageInfo: { lastPage: 4 } as never,
    });

    expect((await fetchDiscoverData("anime", 3)).hasMore).toBe(true);
    expect((await fetchDiscoverData("anime", 4)).hasMore).toBe(false);
  });

  it("manga: hasMore desde ceil(total/20) (MangaDex)", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [{ id: "1", title: "M" }] as never[],
      total: 21, // ceil(21/20) = 2 páginas
      offset: 0,
    });

    expect((await fetchDiscoverData("manga", 1)).hasMore).toBe(true);
    expect((await fetchDiscoverData("manga", 2)).hasMore).toBe(false);
  });

  it("book: hasMore desde ceil(numFound/20)", async () => {
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 60, // ceil(60/20)=3
      docs: [{ key: "/works/OL1W", title: "B" }],
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
    vi.mocked(discoverAnime).mockRejectedValue(new Error("boom"));
    const result = await fetchDiscoverData("anime", 1);
    expect(result.fetchErrorKind).toBe("generic");
    expect(result.hasMore).toBe(false);
  });
});

// ── E79 slice 2: totalPages null cuando hay post-filtro activo ────────────────
// El totalPages crudo del proveedor NO refleja el recorte de un post-filtro
// (tv+temporadas, manga+volumenes, game+valoracion/estado/modojuego/duracionmedia)
// → se devuelve `null` para que la UI omita la "última página [N]" mentirosa. Los
// filtros nativos (movie+valoracion vía vote_average.gte) NO disparan el null.

describe("fetchDiscoverData — totalPages null con post-filtro activo (E79 slice 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("REGRESIÓN game+valoracion: count crudo enorme → totalPages null (no 45018)", async () => {
    // Repro exacto: RAWG count=900360 → ceil/20 = 45018 páginas crudas. valoracion
    // es POST-filtro (metacritic), recorta a ~1 item sin recomputar el conteo.
    // SIN el fix, totalPages sería 45018 y la UI pintaría [1] … [45018] con salto a
    // páginas vacías. CON el fix, totalPages es null → sin última página falsa.
    vi.mocked(getPopularGames).mockResolvedValue({
      results: [{ id: 1, name: "G" }],
      count: 900360,
    } as never);

    const result = await fetchDiscoverData("game", 1, { valoracion: "9" });
    expect(result.totalPages).toBeNull();
    // hasMore SIGUE gobernado por la fuente cruda (gate de "siguiente"): page 1 <
    // 45018 → true. Es el número lo que deja de exponerse, no el avance.
    expect(result.hasMore).toBe(true);
  });

  it("game sin post-filtro → totalPages numérico (ventana completa fiable)", async () => {
    vi.mocked(getPopularGames).mockResolvedValue({
      results: [{ id: 1, name: "G" }],
      count: 40, // ceil/20 = 2
    } as never);

    const result = await fetchDiscoverData("game", 1, {});
    expect(result.totalPages).toBe(2);
  });

  it("CONTRASTE movie+valoracion (NATIVO): totalPages numérico intacto", async () => {
    // movie aplica valoracion como vote_average.gte NATIVO (en el builder) → el
    // proveedor ya devuelve el total correcto, NO es post-filtro → totalPages real.
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 7,
    } as never);

    const result = await fetchDiscoverData("movie", 1, { valoracion: "9" });
    expect(result.totalPages).toBe(7);
  });

  it("tv+temporadas → totalPages null (post-filtro sobre metadata.seasons)", async () => {
    vi.mocked(discoverTV).mockResolvedValue({
      results: [{ id: 1, name: "T" }],
      total_pages: 200,
    } as never);

    const result = await fetchDiscoverData("tv", 1, { temporadas: "1" });
    expect(result.totalPages).toBeNull();
  });

  it("tv sin temporadas → totalPages numérico (capado al tope común)", async () => {
    vi.mocked(discoverTV).mockResolvedValue({
      results: [{ id: 1, name: "T" }],
      total_pages: 200,
    } as never);

    const result = await fetchDiscoverData("tv", 1, {});
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
  });

  it("manga+volumenes → totalPages null (post-filtro sobre metadata.volumes)", async () => {
    vi.mocked(getPopularManga).mockResolvedValue({
      data: [{ id: "1", title: "M", volumes: 10 }] as never[],
      total: 1000,
      offset: 0,
    });

    const result = await fetchDiscoverData("manga", 1, { volumenes: "6-20" });
    expect(result.totalPages).toBeNull();
  });

  it("game error (catch) → totalPages numérico (1), no null (no hay recorte que ocultar)", async () => {
    vi.mocked(getPopularGames).mockRejectedValue(new Error("boom"));
    const result = await fetchDiscoverData("game", 1, { valoracion: "9" });
    expect(result.fetchErrorKind).toBe("generic");
    expect(result.totalPages).toBe(1);
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
    vi.mocked(discoverAnime).mockResolvedValue({
      media: five((i) => ({ id: `a${i}`, title: "A" })) as never[],
      pageInfo: { lastPage: 1 } as never,
    });
    vi.mocked(searchOpenLibrary).mockResolvedValue({
      numFound: 5,
      docs: five((i) => ({ key: `/works/OL${i}W`, title: "B" })),
    } as never);
    vi.mocked(getPopularManga).mockResolvedValue({
      data: five((i) => ({ id: `g${i}`, title: "G" })) as never[],
      total: 5,
      offset: 0,
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

// ── E89: cap totalPages al tope servible del proveedor (TMDB hard cap 500) ─────
// TMDB reporta total_pages enorme (hasta 57464) pero la API solo SIRVE 500. Sin
// cap, la UI numerada ofrece una "última página" que devuelve 4xx → banner rojo
// falso. Capamos a 500 y distinguimos página fuera de rango (vacío, sin error).

describe("fetchDiscoverData — tope común de páginas (E79-s3, antes E89)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("movie: total_pages enorme → totalPages capado al tope común", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 57464,
    } as never);

    const result = await fetchDiscoverData("movie", 1);
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
    expect(result.hasMore).toBe(true); // page 1 < tope
  });

  it("tv: total_pages enorme → totalPages capado al tope común", async () => {
    vi.mocked(discoverTV).mockResolvedValue({
      results: [{ id: 2, name: "T" }],
      total_pages: 30000,
    } as never);

    const result = await fetchDiscoverData("tv", 1);
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
  });

  it("movie: total_pages < tope → sin cambio (no infla)", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 42,
    } as never);

    const result = await fetchDiscoverData("movie", 1);
    expect(result.totalPages).toBe(42);
  });

  it("movie: última página del tope → hasMore false (no ofrece siguiente)", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 57464,
    } as never);

    const result = await fetchDiscoverData("movie", DISCOVER_MAX_PAGES);
    expect(result.hasMore).toBe(false);
  });

  it("page > tope (fuera de rango) → vacío, SIN banner de error, sin llamada API", async () => {
    const result = await fetchDiscoverData("movie", DISCOVER_MAX_PAGES + 1);
    expect(result.items).toEqual([]);
    expect(result.fetchErrorKind).toBeNull(); // NO "generic" → sin banner rojo
    expect(result.hasMore).toBe(false);
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
    expect(discoverMovies).not.toHaveBeenCalled();
  });

  // E79-s3: el guard es ahora COMÚN — antes solo existía para movie/tv (E89), y
  // anime/manga/book/comic/game llamaban al proveedor con una página imposible.
  it("el guard de fuera de rango aplica a TODAS las familias, sin llamar al proveedor", async () => {
    for (const type of ["tv", "anime", "manga", "book", "comic", "game"]) {
      const result = await fetchDiscoverData(type, 9999);
      expect(result.items).toEqual([]);
      expect(result.fetchErrorKind).toBeNull();
      expect(result.hasMore).toBe(false);
      expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
    }
    expect(discoverTV).not.toHaveBeenCalled();
    expect(discoverAnime).not.toHaveBeenCalled();
    expect(getPopularManga).not.toHaveBeenCalled();
    expect(searchOpenLibrary).not.toHaveBeenCalled();
    expect(getRecentComics).not.toHaveBeenCalled();
    expect(getPopularGames).not.toHaveBeenCalled();
  });

  it("comic y game: el conteo crudo del proveedor ya no se expone sin tope", async () => {
    vi.mocked(getRecentComics).mockResolvedValue({
      items: [{ id: "comic_1", title: "C" }],
      total: 200_000,
    } as never);
    const comic = await fetchDiscoverData("comic", 1);
    expect(comic.totalPages).toBe(DISCOVER_MAX_PAGES);

    vi.mocked(getPopularGames).mockResolvedValue({
      results: [{ id: 1, name: "G", rating: 4 }],
      count: 900_360, // el caso real de RAWG: 45018 páginas fantasma
    } as never);
    const game = await fetchDiscoverData("game", 1);
    expect(game.totalPages).toBe(DISCOVER_MAX_PAGES);
  });
});

// ── Rama de BÚSQUEDA (E-DISCOVER-SEARCH-MERGE) ───────────────────────────────

describe("fetchDiscoverData — modo búsqueda (query)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchByTypePaged).mockResolvedValue({
      items: [{ id: "movie_1", title: "Dune" } as never],
      totalPages: 12,
      hasMore: true,
    });
  });

  it("con query delega en searchByTypePaged (NO en el catálogo de descubrir)", async () => {
    const result = await fetchDiscoverData("movie", 2, {}, "en", "dune");
    expect(searchByTypePaged).toHaveBeenCalledWith("dune", "movie", 2, "en");
    expect(discoverMovies).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(12);
    expect(result.hasMore).toBe(true);
    expect(result.fetchErrorKind).toBeNull();
  });

  it("sin query NO toca el buscador (catálogo normal)", async () => {
    vi.mocked(discoverMovies).mockResolvedValue({
      results: [{ id: 1, title: "M" }],
      total_pages: 3,
    } as never);
    await fetchDiscoverData("movie", 1, {});
    expect(searchByTypePaged).not.toHaveBeenCalled();
  });

  it("respeta el tope común de páginas también en búsqueda", async () => {
    vi.mocked(searchByTypePaged).mockResolvedValue({
      items: [],
      totalPages: 50_000,
      hasMore: true,
    });
    const result = await fetchDiscoverData("movie", 1, {}, "es", "dune");
    expect(result.totalPages).toBe(DISCOVER_MAX_PAGES);
  });

  it("totalPages null del buscador se conserva (ventana abierta)", async () => {
    vi.mocked(searchByTypePaged).mockResolvedValue({
      items: [],
      totalPages: null,
      hasMore: true,
    });
    const result = await fetchDiscoverData("all", 1, {}, "es", "dune");
    expect(result.totalPages).toBeNull();
  });

  it("un fallo del buscador devuelve fetchErrorKind sin lanzar", async () => {
    vi.mocked(searchByTypePaged).mockRejectedValue(new Error("boom"));
    const result = await fetchDiscoverData("movie", 1, {}, "es", "dune");
    expect(result.items).toEqual([]);
    expect(result.fetchErrorKind).toBe("generic");
    expect(result.hasMore).toBe(false);
  });

  it("429 de Jikan en búsqueda → fetchErrorKind rate-limit", async () => {
    vi.mocked(searchByTypePaged).mockRejectedValue(
      new JikanError("/anime", 429)
    );
    const result = await fetchDiscoverData("anime", 1, {}, "es", "cowboy");
    expect(result.fetchErrorKind).toBe("rate-limit");
  });

  it("página fuera del tope → vacío sin error y sin buscar", async () => {
    const result = await fetchDiscoverData(
      "movie",
      DISCOVER_MAX_PAGES + 5,
      {},
      "es",
      "dune"
    );
    expect(result.items).toEqual([]);
    expect(result.fetchErrorKind).toBeNull();
    expect(searchByTypePaged).not.toHaveBeenCalled();
  });
});

// ============================================================
// Diagnóstico legible del fallo de proveedor
//
// El visor de logs de Vercel pinta `context` colapsado, así que un error
// serializado ahí dentro no se lee sin abrir cada línea. Lo que se protege
// aquí es que el mensaje VISIBLE baste para diagnosticar: qué familia, qué
// página y qué error exacto (con status o con causa de red).
// ============================================================

describe("fetchDiscoverData — el error se lee en el mensaje del log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("un error con status lo pone en la línea visible", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("Open Library /search.json → 503"), {
      name: "OpenLibraryError",
      status: 503,
    });
    vi.mocked(searchOpenLibrary).mockRejectedValueOnce(err);

    const res = await fetchDiscoverData("book", 1);

    expect(res.fetchErrorKind).toBe("generic");
    const line = spy.mock.calls.map((c) => c.map(String).join(" ")).join(" ");
    expect(line).toContain("type=book");
    expect(line).toContain("status=503");
    spy.mockRestore();
  });

  it("un fallo de red expone la causa, que es lo que distingue timeout de bloqueo", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TypeError("fetch failed");
    err.cause = new Error("ConnectTimeoutError");
    vi.mocked(searchOpenLibrary).mockRejectedValueOnce(err);

    await fetchDiscoverData("book", 1);

    const line = spy.mock.calls.map((c) => c.map(String).join(" ")).join(" ");
    expect(line).toContain("fetch failed");
    expect(line).toContain("ConnectTimeoutError");
    spy.mockRestore();
  });
});
