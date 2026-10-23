import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/api/discover", () => ({ fetchDiscoverData: vi.fn() }));
vi.mock("@/lib/translate/synopsis", () => ({
  translateSynopsis: vi.fn(async ({ text }: { text: string }) => text),
}));
vi.mock("@/lib/api/anime-tmdb", () => ({
  searchAnimeTmdb: vi.fn(async () => ({ items: [], totalPages: 1 })),
}));
vi.mock("@/lib/api/rawg", () => ({ getGame: vi.fn() }));
vi.mock("@/lib/api/steam", () => ({
  getSteamAppDetails: vi.fn(),
  steamAppIdFromRawgGame: vi.fn(() => null),
}));

import {
  bestMinVotes,
  bestYears,
  computeSelection,
  getBestOf,
  getBestRanking,
  getFeaturedRanking,
  isIndexableRanking,
  BEST_INDEX_MIN_ITEMS,
  parseBestParams,
  pickBest,
} from "@/lib/best/best-of";
import { fetchDiscoverData } from "@/lib/api/discover";
import type { MediaItem } from "@/types/media";

const today = new Date("2026-10-21");
const item = (id: string, over: Partial<MediaItem> = {}): MediaItem => ({
  id,
  externalId: id,
  type: "anime",
  title: id,
  poster: "https://x/p.jpg",
  ...over,
});
const ok = (items: MediaItem[]) => ({ items, totalPages: 1, hasMore: false, fetchErrorKind: null });
const failed = { items: [], totalPages: 1, hasMore: false, fetchErrorKind: "generic" };

beforeEach(() => {
  vi.mocked(fetchDiscoverData).mockReset();
});

describe("best-of — años publicados (ROJO-12)", () => {
  it("publica desde 2024 hasta el año actual", () => {
    expect(bestYears(today)).toEqual([2026, 2025, 2024]);
  });

  it("el 1 de enero de 2027 2024 sigue publicado (las URL compartidas no dan 404)", () => {
    const newYear = new Date("2027-01-01T00:00:00Z");
    expect(bestYears(newYear)).toEqual([2027, 2026, 2025, 2024]);
    expect(parseBestParams("movie", "2024", newYear)).toEqual({ format: "movie", year: 2024 });
    expect(parseBestParams("movie", "2027", newYear)).toEqual({ format: "movie", year: 2027 });
  });

  it("valida formato y año; lo demás es 404", () => {
    expect(parseBestParams("anime", "2026", today)).toEqual({ format: "anime", year: 2026 });
    expect(parseBestParams("book", "2026", today)).toBeNull();
    expect(parseBestParams("anime", "2023", today)).toBeNull();
    expect(parseBestParams("anime", "2027", today)).toBeNull();
    expect(parseBestParams("anime", "abc", today)).toBeNull();
  });
});

describe("best-of — pickBest", () => {
  it("descarta sin portada y duplicados, y el rating 0 no se pinta", () => {
    const out = pickBest([
      item("a", { rating: 0 }),
      item("b", { poster: undefined }),
      item("a"),
      item("c", { rating: 8.5, genres: ["1", "2", "3", "4"] }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["a", "c"]);
    expect(out[0].rating).toBeUndefined();
    expect(out[1].genres).toHaveLength(3);
  });

  it("deduplica por título normalizado (HELLDIVERS 2 = Helldivers II)", () => {
    const out = pickBest([
      item("g1", { title: "HELLDIVERS 2" }),
      item("g2", { title: "Helldivers II" }),
      item("g3", { title: "Hades II" }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["g1", "g3"]);
  });
});

describe("best-of — suelo de votos (E-BEST-VOTOS / PRO-8)", () => {
  it("más exigente en años cerrados y algo más en el año en curso; anime no lo usa", () => {
    expect(bestMinVotes("movie", 2026, today)).toBe(500);
    expect(bestMinVotes("movie", 2025, today)).toBe(1500);
    expect(bestMinVotes("tv", 2026, today)).toBe(300);
    expect(bestMinVotes("tv", 2025, today)).toBe(500);
    expect(bestMinVotes("anime", 2026, today)).toBeUndefined();
    expect(bestMinVotes("game", 2026, today)).toBe(25);
    expect(bestMinVotes("game", 2025, today)).toBe(60);
  });
});

describe("best-of — calidad de la selección (DAT-3)", () => {
  it("cine: fuera las notas < 7 y, en un año cerrado, la lista se acorta en vez de rellenarse", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(
        ok([
          item("m1", { type: "movie", rating: 8.4, synopsis: "s" }),
          item("m2", { type: "movie", rating: 7.0, synopsis: "s" }),
          item("m3", { type: "movie", rating: 6.9, synopsis: "s" }),
          item("m4", { type: "movie", rating: 5.3, synopsis: "s" }),
        ]) as never,
      )
      .mockResolvedValueOnce(ok([]) as never);
    const s = await computeSelection("movie", 2025, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["m1", "m2"]);
    expect(s.degraded).toBe(false);
    const calls = vi.mocked(fetchDiscoverData).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][2]).toMatchObject({ minVotes: 1500, sort: "rating", year: "2025" });
  });

  it("año en curso con la lista corta: relaja el suelo de votos, sin bajar la nota mínima", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok([item("m1", { type: "movie", rating: 8, synopsis: "s" })]) as never)
      .mockResolvedValueOnce(ok([]) as never)
      .mockResolvedValueOnce(
        ok([
          item("m1", { type: "movie", rating: 8, synopsis: "s" }),
          item("m2", { type: "movie", rating: 7.5, synopsis: "s" }),
          item("m3", { type: "movie", rating: 7.2, synopsis: "s" }),
          item("m4", { type: "movie", rating: 4, synopsis: "s" }),
        ]) as never,
      )
      .mockResolvedValueOnce(ok([]) as never);
    const s = await computeSelection("movie", 2026, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["m1", "m2", "m3"]);
    const calls = vi.mocked(fetchDiscoverData).mock.calls;
    expect(calls[2][2]).toMatchObject({ minVotes: 125 });
  });

  it("series: fuera la animación japonesa (tiene su ranking), dentro la occidental", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue(
      ok([
        item("t1", {
          type: "tv",
          rating: 9,
          synopsis: "s",
          genres: ["Animación", "Acción y aventura"],
          metadata: { originCountry: ["JP"], originalLanguage: "ja" },
        }),
        item("t2", {
          type: "tv",
          rating: 8.8,
          synopsis: "s",
          genres: ["Animación", "Drama"],
          metadata: { originCountry: ["US"], originalLanguage: "en" },
        }),
        item("t3", { type: "tv", rating: 8.5, synopsis: "s", genres: ["Drama"], metadata: { originCountry: ["JP"] } }),
      ]) as never,
    );
    const s = await computeSelection("tv", 2025, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["t2", "t3"]);
  });

  it("juegos: suelo de valoraciones, orden por nota, nota mínima y sin duplicados", async () => {
    const g = (id: string, count: number | undefined, rating: number, title = id) =>
      item(id, { type: "game", title, rating, metadata: { ratingsCount: count } } as never);
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok([g("a", 90, 8.1), g("b", 50, 9.9), g("c", undefined, 9.8), g("d", 80, 9.0, "Helldivers II")]) as never)
      .mockResolvedValueOnce(ok([g("e", 75, 8.5), g("f", 71, 6.0), g("h", 88, 8.8, "HELLDIVERS 2")]) as never)
      .mockResolvedValue(ok([]) as never);
    const s = await computeSelection("game", 2024, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["d", "e", "a"]);
    expect(vi.mocked(fetchDiscoverData).mock.calls[0][2]).toMatchObject({ sort: "popularity" });
  });

  it("anime: los populares del año reordenados por nota; mismo pedido para /es y /en", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok([item("al-1", { rating: 7.5 }), item("al-2", { rating: 8.9 }), item("al-3", { rating: 6.5 })]) as never)
      .mockResolvedValue(ok([]) as never);
    const s = await computeSelection("anime", 2026, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["al-2", "al-1"]);
    expect(s.degraded).toBe(false);
    const calls = vi.mocked(fetchDiscoverData).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][2]).toMatchObject({ sort: "popularity", year: "2026" });
    expect(calls.every((c) => c[3] === "en")).toBe(true);
  });

  it("anime servido por el respaldo de TMDB → selección degradada (no se fija 24 h)", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok([item("anime_tmdb-5", { externalId: "tmdb-5", rating: 8 })]) as never)
      .mockResolvedValue(ok([]) as never);
    const s = await computeSelection("anime", 2026, "es", today);
    expect(s.degraded).toBe(true);
  });

  it("una página que falla marca la selección como degradada; si fallan todas, lanza", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok([item("m1", { type: "movie", rating: 8, synopsis: "s" })]) as never)
      .mockResolvedValueOnce(failed as never);
    expect((await computeSelection("movie", 2025, "es", today)).degraded).toBe(true);

    vi.mocked(fetchDiscoverData).mockReset();
    vi.mocked(fetchDiscoverData).mockResolvedValue(failed as never);
    await expect(computeSelection("movie", 2025, "es", today)).rejects.toThrow(/no respondió/);
  });

  it("/es con título solo en japonés o sin sinopsis: se completa con la versión inglesa de TMDB", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (_t, page, _f, locale) => {
      if (page !== 1) return ok([]) as never;
      return locale === "en"
        ? (ok([item("t9", { type: "tv", title: "Milky Subway", rating: 8, synopsis: "A galaxy express." })]) as never)
        : (ok([item("t9", { type: "tv", title: "銀河特急 ミルキー☆サブウェイ", rating: 8 })]) as never);
    });
    const s = await computeSelection("tv", 2025, "es", today);
    expect(s.items[0].title).toBe("Milky Subway");
    expect(s.items[0].synopsis).toBe("A galaxy express.");
  });
});

describe("best-of — getBestOf", () => {
  it("lista vacía sin error (p. ej. 1 de enero) → [] en vez de lanzar", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue(ok([]) as never);
    await expect(getBestOf("movie", 2026, "es")).resolves.toEqual([]);
  });

  it("con el proveedor caído y sin versión anterior, lanza (no se cachea el fallo)", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue(failed as never);
    await expect(getBestOf("anime", 2025, "es")).rejects.toThrow();
  });

  it("los géneros salen en el idioma de la página", async () => {
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(
        ok([item("al-1", { rating: 8, synopsis: "x", genres: ["Action", "Slice of Life", "Supernatural", "Drama"] })]) as never,
      )
      .mockResolvedValue(ok([]) as never);
    const [first] = await getBestOf("anime", 2025, "es");
    expect(first.genres).toEqual(["Acción", "Recuentos de la vida", "Sobrenatural"]);
  });
});

describe("best-of — getBestRanking (F-16: criterio y fecha visibles)", () => {
  const movies = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      item(`m${i}`, { externalId: String(550 + i), type: "movie", rating: 9 - i * 0.05, synopsis: "s" }),
    );

  it("devuelve la fecha real de la selección, el suelo aplicado y el id de la ficha", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValueOnce(ok(movies(10)) as never).mockResolvedValue(ok([]) as never);
    const before = Date.now();
    const r = await getBestRanking("movie", 2024, "es");
    expect(r.minVotes).toBe(1500);
    expect(Date.parse(r.updatedAt)).toBeGreaterThanOrEqual(before);
    expect(r.items[0].externalId).toBe("550");
  });

  it("año en curso relajado: el criterio publica el suelo que se usó de verdad", async () => {
    const year = new Date().getFullYear();
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce(ok(movies(1)) as never)
      .mockResolvedValueOnce(ok([]) as never)
      .mockResolvedValueOnce(ok(movies(5)) as never)
      .mockResolvedValue(ok([]) as never);
    const r = await getBestRanking("movie", year, "es");
    expect(r.items).toHaveLength(5);
    expect(r.minVotes).toBe(125);
  });

  it("anime no tiene suelo numérico", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValueOnce(ok([item("al-1", { rating: 8 })]) as never).mockResolvedValue(ok([]) as never);
    expect((await getBestRanking("anime", 2024, "en")).minVotes).toBeUndefined();
  });

  it("una lista de menos de 8 títulos no se indexa (D-16)", () => {
    expect(BEST_INDEX_MIN_ITEMS).toBe(8);
    expect(isIndexableRanking(7)).toBe(false);
    expect(isIndexableRanking(8)).toBe(true);
  });

  it("hubs: si el año en curso aún es corto, enseñan el anterior", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (_t, page, filters) => {
      if (page !== 1) return ok([]) as never;
      const year = Number((filters as { year?: string }).year);
      return ok(year === 2026 ? movies(3) : movies(12)) as never;
    });
    const f = await getFeaturedRanking("movie", "es", today);
    expect(f?.year).toBe(2025);
    expect(f?.ranking.items).toHaveLength(12);
  });
});
