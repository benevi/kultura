// ============================================================
// KULTURA — E-TMDB-LOCALE: el cliente TMDB respeta el locale activo
//
// Regresión del bug real: `tmdbFetch` fijaba `language=es-ES` en TODA petición
// (tmdb.ts:114), así que un usuario con la app en inglés recibía títulos y
// sinopsis en español. Estos tests leen la URL que recibe `fetch`.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchMovies,
  searchTV,
  getMovie,
  getTV,
  discoverMovies,
  discoverTV,
  getMovieVideos,
  getMovieProviders,
  getTVProviders,
} from "@/lib/api/tmdb";

function mockFetchOk() {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [], total_pages: 1, total_results: 0 }),
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Última URL con la que se llamó a fetch, como URL parseada. */
function lastUrl(spy: ReturnType<typeof mockFetchOk>): URL {
  const calls = spy.mock.calls;
  return new URL(calls[calls.length - 1][0] as string);
}

let fetchSpy: ReturnType<typeof mockFetchOk>;

beforeEach(() => {
  fetchSpy = mockFetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("language derivado del locale", () => {
  it("searchMovies: en → en-US", async () => {
    await searchMovies("dune", 1, "en");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
  });

  it("searchMovies: es → es-ES", async () => {
    await searchMovies("dune", 1, "es");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("es-ES");
  });

  it("searchTV: en → en-US", async () => {
    await searchTV("severance", 1, "en");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
  });

  it("getMovie / getTV (ficha de detalle) propagan el locale", async () => {
    await getMovie(550, "en");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
    await getTV(1399, "en");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
  });

  it("discoverMovies / discoverTV (catálogo Descubrir) propagan el locale", async () => {
    await discoverMovies(3, { with_genres: "28" }, "en");
    const movieUrl = lastUrl(fetchSpy);
    expect(movieUrl.searchParams.get("language")).toBe("en-US");
    // el locale no pisa los params de filtro ya existentes
    expect(movieUrl.searchParams.get("with_genres")).toBe("28");
    expect(movieUrl.searchParams.get("page")).toBe("3");

    await discoverTV(1, {}, "en");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
  });

  it("acepta variantes regionales del locale (es-ES / en-GB)", async () => {
    await discoverMovies(1, {}, "en-GB");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("en-US");
    await discoverMovies(1, {}, "es-ES");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("es-ES");
  });

  it("sin locale mantiene es-ES (paridad con el comportamiento anterior)", async () => {
    await discoverMovies(1);
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("es-ES");
    await getMovieVideos(550);
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("es-ES");
  });

  it("un locale desconocido no rompe: cae a es-ES", async () => {
    await searchMovies("dune", 1, "klingon");
    expect(lastUrl(fetchSpy).searchParams.get("language")).toBe("es-ES");
  });
});

describe("watch/providers: región derivada del locale", () => {
  it("en → region=US, es → region=ES", async () => {
    await getMovieProviders(550, undefined, "en");
    expect(lastUrl(fetchSpy).searchParams.get("region")).toBe("US");
    await getMovieProviders(550, undefined, "es");
    expect(lastUrl(fetchSpy).searchParams.get("region")).toBe("ES");
  });

  it("una región explícita sigue mandando sobre el locale", async () => {
    await getTVProviders(1399, "MX", "en");
    expect(lastUrl(fetchSpy).searchParams.get("region")).toBe("MX");
  });

  it("sin argumentos mantiene ES (paridad)", async () => {
    await getTVProviders(1399);
    expect(lastUrl(fetchSpy).searchParams.get("region")).toBe("ES");
  });
});
