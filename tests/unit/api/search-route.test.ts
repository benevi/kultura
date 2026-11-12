// ============================================================
// KULTURA — GET /api/search (autocompletado) — F-06
// El idioma llega en `?locale=` y las respuestas buenas se cachean en el borde.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/tmdb")>()),
  searchMovies: vi.fn(),
  searchTV: vi.fn(),
}));
// Saneamiento 10.2: los fallos se registran (antes se tragaban).
const { logWarn, logError } = vi.hoisted(() => ({ logWarn: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/logger")>()),
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: logWarn, error: logError }),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

import { GET } from "@/app/api/search/route";
import { searchMovies, searchTV } from "@/lib/api/tmdb";
import { _resetStoreForTests } from "@/lib/rate-limit";
import { ProviderError } from "@/lib/api/http";

const movie = (id: number, title: string) => ({
  id,
  title,
  original_title: title,
  poster_path: `/p${id}.jpg`,
  backdrop_path: null,
  release_date: "2010-07-16",
  overview: "",
  vote_average: 8,
});

const req = (q: string) => new NextRequest(`http://localhost/api/search${q}`);

beforeEach(() => {
  vi.clearAllMocks();
  _resetStoreForTests();
  vi.mocked(searchMovies).mockResolvedValue({ results: [movie(27205, "Inception")] } as never);
  vi.mocked(searchTV).mockResolvedValue({ results: [] } as never);
});

describe("GET /api/search", () => {
  it("?locale=en pide a TMDB en inglés", async () => {
    await GET(req("?q=inception&locale=en"));
    expect(searchMovies).toHaveBeenCalledWith("inception", 1, "en");
    expect(searchTV).toHaveBeenCalledWith("inception", 1, "en");
  });

  it("sin ?locale= es español (ya no depende de getLocale)", async () => {
    await GET(req("?q=inception"));
    expect(searchMovies).toHaveBeenCalledWith("inception", 1, "es");
  });

  it("respuesta buena → cacheable en el CDN", async () => {
    const res = await GET(req("?q=inception&locale=es"));
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    expect(await res.json()).toHaveLength(1);
  });

  it("si falla un proveedor no se cachea la respuesta parcial", async () => {
    vi.mocked(searchTV).mockRejectedValueOnce(new Error("TMDB 503"));
    const res = await GET(req("?q=inception&locale=es"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("menos de 2 caracteres → [] sin llamar a TMDB", async () => {
    const res = await GET(req("?q=a"));
    expect(await res.json()).toEqual([]);
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("proveedor caído: aviso (no error), y la búsqueda sigue con lo que hay", async () => {
    vi.mocked(searchTV).mockRejectedValue(new ProviderError("tmdb", "timeout", "tmdb /search/tv → sin respuesta"));
    const res = await GET(req("?q=inception"));
    expect(await res.json()).toHaveLength(1);
    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining("tv"), { provider: "tmdb", kind: "timeout" });
    expect(logError).not.toHaveBeenCalled();
  });

  it("un fallo nuestro (no del proveedor) va a error, no se traga", async () => {
    const bug = new TypeError("x is undefined");
    vi.mocked(searchMovies).mockRejectedValue(bug);
    const res = await GET(req("?q=inception"));
    expect(res.status).toBe(200);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("movie"), { error: bug });
  });
});
