// ============================================================
// KULTURA — E-TMDB-GENRES: los listados de TMDB llegan CON géneros
//
// Regresión del bug real (match 0% universal): /discover, /search, /popular y
// /trending devuelven `genre_ids` (solo ids); `genres` con nombres solo llega
// en la ficha de detalle. Como `normalizeMovie`/`normalizeTV` leen `raw.genres`,
// todo item de listado salía sin género y el match score —donde el género pesa
// 0.7— daba 0% para cualquier película o serie.
//
// Cada test reimporta el módulo (vi.resetModules) porque el catálogo de géneros
// se cachea a nivel de módulo.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const MOVIE_GENRES = [
  { id: 28, name: "Acción" },
  { id: 12, name: "Aventura" },
];
const TV_GENRES = [{ id: 10765, name: "Sci-Fi y Fantasía" }];

/** fetch que responde el catálogo de géneros o un listado, según la URL. */
function mockFetch(results: unknown[], options: { genreListFails?: boolean } = {}) {
  const spy = vi.fn(async (url: string) => {
    if (url.includes("/genre/movie/list")) {
      if (options.genreListFails) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => ({ genres: MOVIE_GENRES }) };
    }
    if (url.includes("/genre/tv/list")) {
      return { ok: true, json: async () => ({ genres: TV_GENRES }) };
    }
    return { ok: true, json: async () => ({ results, total_pages: 1, total_results: results.length }) };
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Nº de peticiones al catálogo de géneros. */
function genreListCalls(spy: ReturnType<typeof mockFetch>, kind: "movie" | "tv" = "movie"): number {
  return spy.mock.calls.filter((c) => String(c[0]).includes(`/genre/${kind}/list`)).length;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hidratación de géneros en listados", () => {
  it("discoverMovies: rellena genres desde genre_ids", async () => {
    mockFetch([{ id: 1, title: "Peli", genre_ids: [28, 12] }]);
    const { discoverMovies } = await import("@/lib/api/tmdb");

    const res = await discoverMovies(1, {}, "es");

    expect(res.results[0].genres).toEqual(MOVIE_GENRES);
  });

  it("searchTV: usa el catálogo de TV, no el de películas", async () => {
    const spy = mockFetch([{ id: 2, name: "Serie", genre_ids: [10765] }]);
    const { searchTV } = await import("@/lib/api/tmdb");

    const res = await searchTV("expanse", 1, "es");

    expect(res.results[0].genres).toEqual(TV_GENRES);
    expect(genreListCalls(spy, "tv")).toBe(1);
    expect(genreListCalls(spy, "movie")).toBe(0);
  });

  it("el catálogo se cachea: dos listados → una sola petición de géneros", async () => {
    const spy = mockFetch([{ id: 1, title: "Peli", genre_ids: [28] }]);
    const { discoverMovies, getPopularMovies } = await import("@/lib/api/tmdb");

    await discoverMovies(1, {}, "es");
    await getPopularMovies(1, "es");

    expect(genreListCalls(spy)).toBe(1);
  });

  it("cachea por idioma: es y en son entradas distintas", async () => {
    const spy = mockFetch([{ id: 1, title: "Peli", genre_ids: [28] }]);
    const { discoverMovies } = await import("@/lib/api/tmdb");

    await discoverMovies(1, {}, "es");
    await discoverMovies(1, {}, "en");

    expect(genreListCalls(spy)).toBe(2);
    const genreUrls = spy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/genre/movie/list"));
    expect(new URL(genreUrls[0]).searchParams.get("language")).toBe("es-ES");
    expect(new URL(genreUrls[1]).searchParams.get("language")).toBe("en-US");
  });

  it("items que ya traen genres no disparan la petición del catálogo", async () => {
    const spy = mockFetch([
      { id: 1, title: "Peli", genres: [{ id: 99, name: "Ya venía" }] },
    ]);
    const { discoverMovies } = await import("@/lib/api/tmdb");

    const res = await discoverMovies(1, {}, "es");

    expect(res.results[0].genres).toEqual([{ id: 99, name: "Ya venía" }]);
    expect(genreListCalls(spy)).toBe(0);
  });

  it("listado vacío: no pide el catálogo", async () => {
    const spy = mockFetch([]);
    const { discoverMovies } = await import("@/lib/api/tmdb");

    await discoverMovies(1, {}, "es");

    expect(genreListCalls(spy)).toBe(0);
  });

  it("ids desconocidos se descartan sin dejar huecos", async () => {
    mockFetch([{ id: 1, title: "Peli", genre_ids: [28, 99999] }]);
    const { discoverMovies } = await import("@/lib/api/tmdb");

    const res = await discoverMovies(1, {}, "es");

    expect(res.results[0].genres).toEqual([{ id: 28, name: "Acción" }]);
  });

  it("si el catálogo falla, el listado sigue sirviéndose sin géneros", async () => {
    mockFetch([{ id: 1, title: "Peli", genre_ids: [28] }], { genreListFails: true });
    const { discoverMovies } = await import("@/lib/api/tmdb");

    const res = await discoverMovies(1, {}, "es");

    expect(res.results[0].genres).toBeUndefined();
    expect(res.results[0].title).toBe("Peli");
  });

  it("un fallo del catálogo NO se cachea: la siguiente petición reintenta", async () => {
    const spy = mockFetch([{ id: 1, title: "Peli", genre_ids: [28] }], { genreListFails: true });
    const { discoverMovies } = await import("@/lib/api/tmdb");

    await discoverMovies(1, {}, "es");
    await discoverMovies(1, {}, "es");

    expect(genreListCalls(spy)).toBe(2);
  });
});
