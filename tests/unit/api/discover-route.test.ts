// ============================================================
// KULTURA — Route Handler GET /api/discover unit tests (E59 F2)
// Verifica: parser de params canónicos, propagación type+page a
// fetchDiscoverData, fallback de type inválido, manejo 429 (fetchErrorKind).
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de la capa de fetch — el handler solo debe orquestar, no tocar APIs.
vi.mock("@/lib/api/discover", () => ({
  fetchDiscoverData: vi.fn(),
}));

import { GET } from "@/app/api/discover/route";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { fetchDiscoverData } from "@/lib/api/discover";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/discover${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiscoverData).mockResolvedValue({
    items: [],
    totalPages: 1,
    fetchErrorKind: null,
  });
});

// ── parseDiscoverParams ───────────────────────────────────────────────────────

describe("parseDiscoverParams", () => {
  it("defaults: type=movie, page=1 cuando no hay query", () => {
    const p = parseDiscoverParams(new URLSearchParams());
    expect(p.type).toBe("movie");
    expect(p.page).toBe(1);
  });

  it("type inválido cae a movie", () => {
    const p = parseDiscoverParams(new URLSearchParams("type=banana"));
    expect(p.type).toBe("movie");
  });

  it("acepta los 7 tipos válidos", () => {
    for (const t of ["movie", "tv", "anime", "manga", "book", "game", "comic"]) {
      expect(parseDiscoverParams(new URLSearchParams(`type=${t}`)).type).toBe(t);
    }
  });

  it("page se clampa a >= 1 y parsea entero", () => {
    expect(parseDiscoverParams(new URLSearchParams("page=5")).page).toBe(5);
    expect(parseDiscoverParams(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseDiscoverParams(new URLSearchParams("page=-3")).page).toBe(1);
    expect(parseDiscoverParams(new URLSearchParams("page=abc")).page).toBe(1);
  });

  it("params multi (genre/platform/editorial) se parsean a array", () => {
    const p = parseDiscoverParams(
      new URLSearchParams("genre=accion,drama&platform=netflix&editorial=")
    );
    expect(p.genre).toEqual(["accion", "drama"]);
    expect(p.platform).toEqual(["netflix"]);
    expect(p.editorial).toEqual([]);
  });

  it("params single reservados se exponen (year/sort/status…)", () => {
    const p = parseDiscoverParams(
      new URLSearchParams("year=2010s&sort=rating&status=airing")
    );
    expect(p.year).toBe("2010s");
    expect(p.sort).toBe("rating");
    expect(p.status).toBe("airing");
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe("GET /api/discover", () => {
  it("propaga type + page a fetchDiscoverData", async () => {
    await GET(req("?type=anime&page=3"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "anime",
      3,
      expect.any(Object)
    );
  });

  it("F3a: pasa los filtros TMDB al fetch (genre/year/sort/…)", async () => {
    await GET(req("?type=tv&page=1&genre=accion-aventura&sort=rating&year=2024"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "tv",
      1,
      expect.objectContaining({
        genre: ["accion-aventura"],
        sort: "rating",
        year: "2024",
      })
    );
    expect(fetchDiscoverData).toHaveBeenCalledTimes(1);
  });

  it("type inválido → fetch con 'movie'", async () => {
    await GET(req("?type=xyz&page=2"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "movie",
      2,
      expect.any(Object)
    );
  });

  it("devuelve el payload normalizado como JSON", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue({
      items: [{ id: "movie_1", title: "X" } as never],
      totalPages: 7,
      fetchErrorKind: null,
    });
    const res = await GET(req("?type=movie&page=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.totalPages).toBe(7);
    expect(body.fetchErrorKind).toBeNull();
  });

  it("429: propaga fetchErrorKind='rate-limit' en el body (status 200)", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue({
      items: [],
      totalPages: 1,
      fetchErrorKind: "rate-limit",
    });
    const res = await GET(req("?type=anime&page=1"));
    // fetchDiscoverData nunca lanza: el 429 viaja como fetchErrorKind, status 200.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fetchErrorKind).toBe("rate-limit");
  });
});
