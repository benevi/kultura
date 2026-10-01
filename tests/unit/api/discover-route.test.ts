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

// F3b: el handler consulta el usuario autenticado para calcular matchScores
// (F3a). Sin sesión por defecto — los tests de este archivo no ejercitan auth.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));
vi.mock("@/lib/recommendations/match-score", () => ({
  computeMatchScores: vi.fn().mockResolvedValue(new Map()),
}));

// E-TMDB-LOCALE: el handler resuelve el locale activo con `getLocale()`
// (next-intl/server no está disponible fuera de un request real).
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("es"),
}));

import { getLocale } from "next-intl/server";
import { GET } from "@/app/api/discover/route";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { fetchDiscoverData } from "@/lib/api/discover";
import { computeMatchScores } from "@/lib/recommendations/match-score";

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/discover${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchDiscoverData).mockResolvedValue({
    items: [],
    totalPages: 1,
    hasMore: false,
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

  it("R4b: el paramKey 'rating' se lee en el field valoracion (puente de naming)", () => {
    const p = parseDiscoverParams(new URLSearchParams("rating=8"));
    expect(p.valoracion).toBe("8");
  });

  it("R4c-2: el paramKey 'seasons' se lee en el field temporadas (puente)", () => {
    const p = parseDiscoverParams(new URLSearchParams("seasons=4-6"));
    expect(p.temporadas).toBe("4-6");
  });

  // ── E-DISCOVER-SEARCH-MERGE: q ─────────────────────────────────────────────
  it("q se trimea y se expone tal cual con 2+ caracteres", () => {
    expect(parseDiscoverParams(new URLSearchParams("q=dune")).q).toBe("dune");
    expect(parseDiscoverParams(new URLSearchParams("q=%20%20dune%20%20")).q).toBe(
      "dune"
    );
  });

  it("q con menos de 2 caracteres (o ausente) → null, no se busca", () => {
    expect(parseDiscoverParams(new URLSearchParams("q=d")).q).toBeNull();
    expect(parseDiscoverParams(new URLSearchParams("q=%20")).q).toBeNull();
    expect(parseDiscoverParams(new URLSearchParams()).q).toBeNull();
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe("GET /api/discover", () => {
  it("propaga type + page a fetchDiscoverData", async () => {
    await GET(req("?type=anime&page=3"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "anime",
      3,
      expect.any(Object),
      "es",
      null
    );
  });

  it("F3a: pasa los filtros TMDB al fetch (genre/year/sort/…)", async () => {
    await GET(req("?type=tv&page=1&genre=accion-aventura&sort=rating&year=2024"));
    expect(fetchDiscoverData).toHaveBeenCalledWith("tv", 1, expect.objectContaining({
        genre: ["accion-aventura"],
        sort: "rating",
        year: "2024",
      }),
      "es",
      null
    );
    expect(fetchDiscoverData).toHaveBeenCalledTimes(1);
  });

  it("R4a: reenvía los campos consumibles que antes se perdían (volumenes/editorial/formato)", async () => {
    await GET(
      req("?type=comic&page=1&volumenes=2-5&editorial=planeta,norma&formato=ebook")
    );
    expect(fetchDiscoverData).toHaveBeenCalledWith("comic", 1, expect.objectContaining({
        volumenes: "2-5",
        editorial: ["planeta", "norma"],
        formato: "ebook",
      }),
      "es",
      null
    );
  });

  it("R4a: reenvía los 8 keys nativos (genre/year/platform/sort/status/demografia/duracion/idioma)", async () => {
    await GET(
      req(
        "?type=anime&page=1&genre=accion&year=2024&platform=netflix&sort=rating&status=airing&demografia=shonen&duracion=lt90&idioma=ja"
      )
    );
    expect(fetchDiscoverData).toHaveBeenCalledWith("anime", 1, expect.objectContaining({
        genre: ["accion"],
        year: "2024",
        platform: ["netflix"],
        sort: "rating",
        status: "airing",
        demografia: "shonen",
        duracion: "lt90",
        idioma: "ja",
      }),
      "es",
      null
    );
  });

  it("R4b: mapea el paramKey 'rating' del front → valoracion aguas abajo", async () => {
    await GET(req("?type=movie&page=1&rating=8"));
    expect(fetchDiscoverData).toHaveBeenCalledWith("movie", 1, expect.objectContaining({ valoracion: "8" }),
      "es",
      null
    );
  });

  it("R4c-1: puentea gamemode→modojuego, playtime→duracionmedia, estado→estado", async () => {
    await GET(
      req("?type=game&page=1&gamemode=single,coop&playtime=10-30&estado=early-access")
    );
    expect(fetchDiscoverData).toHaveBeenCalledWith("game", 1, expect.objectContaining({
        modojuego: ["single", "coop"],
        duracionmedia: "10-30",
        estado: "early-access",
      }),
      "es",
      null
    );
  });

  it("R4c-2: puentea seasons→temporadas aguas abajo", async () => {
    await GET(req("?type=tv&page=1&seasons=2-3"));
    expect(fetchDiscoverData).toHaveBeenCalledWith("tv", 1, expect.objectContaining({ temporadas: "2-3" }),
      "es",
      null
    );
  });

  it("type inválido → fetch con 'movie'", async () => {
    await GET(req("?type=xyz&page=2"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "movie",
      2,
      expect.any(Object),
      "es",
      null
    );
  });

  it("devuelve el payload normalizado como JSON", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue({
      items: [{ id: "movie_1", title: "X" } as never],
      totalPages: 7,
      hasMore: true,
      fetchErrorKind: null,
    });
    const res = await GET(req("?type=movie&page=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.totalPages).toBe(7);
    // E79 slice 1: hasMore viaja en el payload.
    expect(body.hasMore).toBe(true);
    expect(body.fetchErrorKind).toBeNull();
  });

  it("429: propaga fetchErrorKind='rate-limit' en el body (status 200)", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue({
      items: [],
      totalPages: 1,
      hasMore: false,
      fetchErrorKind: "rate-limit",
    });
    const res = await GET(req("?type=anime&page=1"));
    // fetchDiscoverData nunca lanza: el 429 viaja como fetchErrorKind, status 200.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fetchErrorKind).toBe("rate-limit");
  });

  // E-MATCH-SIN-BADGE: el catálogo ya no puntúa la afinidad de cada item. Se
  // calculaba SOLO para el badge del grid; retirado el badge, era una lectura
  // de biblioteca + scoring en cada petición para un dato que no ve nadie.
  it("no calcula match ni lo adjunta a la respuesta", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    } as never);

    const res = await GET(req("?type=movie&page=1"));
    const body = await res.json();
    expect(body.matchScores).toBeUndefined();
    expect(computeMatchScores).not.toHaveBeenCalled();
  });

  // ── E-DISCOVER-SEARCH-MERGE ────────────────────────────────────────────────
  it("propaga q como 5º argumento de fetchDiscoverData", async () => {
    await GET(req("?type=movie&page=2&q=dune"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "movie",
      2,
      expect.any(Object),
      "es",
      "dune"
    );
  });

  it("q de 1 carácter no activa búsqueda (llega null)", async () => {
    await GET(req("?type=movie&page=1&q=d"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "movie",
      1,
      expect.any(Object),
      "es",
      null
    );
  });

  // ── E-TMDB-LOCALE ───────────────────────────────────────────────────────────
  it("propaga el locale activo como 4º argumento de fetchDiscoverData", async () => {
    vi.mocked(getLocale).mockResolvedValueOnce("en");
    await GET(req("?type=movie&page=1"));
    expect(fetchDiscoverData).toHaveBeenCalledWith(
      "movie",
      1,
      expect.any(Object),
      "en",
      null
    );
  });
});
