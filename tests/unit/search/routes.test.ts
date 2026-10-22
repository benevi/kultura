// @vitest-environment node
// ============================================================
// KULTURA — Rutas de búsqueda (F-13)
//   - /api/search?type=… (DAT-8): con el tipo manga, 5 sugerencias de manga;
//     sin portada o con nota < 5, fuera.
//   - /api/users/search: comodines de LIKE escapados y límite compartido.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { MediaItem } from "@/types/media";

vi.mock("@/lib/api/search", () => ({ searchByType: vi.fn() }));
vi.mock("@/lib/api/steam", () => ({ searchSteamSuggestions: vi.fn() }));
vi.mock("@/lib/api/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/tmdb")>()),
  searchMovies: vi.fn(),
  searchTV: vi.fn(),
}));

const { ilike, getUser } = vi.hoisted(() => ({ ilike: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        ilike: (col: string, pattern: string) => {
          ilike(col, pattern);
          return { neq: () => ({ limit: async () => ({ data: [] }) }) };
        },
      }),
    }),
  }),
}));

import { GET as searchGET } from "@/app/api/search/route";
import { GET as usersGET } from "@/app/api/users/search/route";
import { searchByType } from "@/lib/api/search";
import { searchSteamSuggestions } from "@/lib/api/steam";
import { searchMovies, searchTV } from "@/lib/api/tmdb";
import { _resetStoreForTests } from "@/lib/rate-limit";

const manga = (id: number, title: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  id: `manga_${id}`,
  externalId: String(id),
  type: "manga",
  title,
  poster: `https://uploads.mangadex.org/covers/${id}.jpg`,
  rating: 8,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  _resetStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/search?type=manga (DAT-8)", () => {
  it("con el tipo manga: 5 sugerencias, todas manga, sin llamar a TMDB", async () => {
    vi.mocked(searchByType).mockResolvedValue([
      manga(1, "Naruto"),
      manga(2, "Boruto: Naruto Next Generations"),
      manga(3, "Naruto: Road to Ninja"),
      manga(4, "NARUTO: Konoha Shinden"),
      manga(5, "Naruto Gaiden"),
      manga(6, "Naruto: Kai no Sho"),
      manga(7, "Naruto: Rai no Sho"),
    ]);
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=naruto&type=manga&locale=es"));
    const body = (await res.json()) as MediaItem[];
    expect(body).toHaveLength(5);
    expect(body.every((i) => i.type === "manga")).toBe(true);
    expect(body[0].title).toBe("Naruto");
    expect(searchByType).toHaveBeenCalledWith("naruto", "manga", "es");
    expect(searchMovies).not.toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("descarta sin portada y con nota < 5 (si la tienen); sin nota pasa", async () => {
    vi.mocked(searchByType).mockResolvedValue([
      manga(1, "A", { poster: undefined }),
      manga(2, "B", { rating: 3.9 }),
      manga(3, "C", { rating: undefined }),
      manga(4, "D", { rating: 5 }),
    ]);
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=abc&type=manga"));
    expect(((await res.json()) as MediaItem[]).map((i) => i.title)).toEqual(["C", "D"]);
  });

  it("juegos: sugerencias de la tienda de Steam (sin gastar el cupo de RAWG), por relevancia", async () => {
    vi.mocked(searchSteamSuggestions).mockResolvedValue([
      { id: "game_steam-1030300", externalId: "steam-1030300", type: "game", title: "Hollow Knight: Silksong", poster: "https://shared.akamai.steamstatic.com/a.jpg" },
      { id: "game_steam-367520", externalId: "steam-367520", type: "game", title: "Hollow Knight", poster: "https://shared.akamai.steamstatic.com/b.jpg" },
    ]);
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=hollow%20knight&type=game&locale=es"));
    const body = (await res.json()) as MediaItem[];
    expect(body.map((i) => i.title)).toEqual(["Hollow Knight", "Hollow Knight: Silksong"]);
    expect(searchSteamSuggestions).toHaveBeenCalledWith("hollow knight", "es");
    expect(searchByType).not.toHaveBeenCalled();
  });

  it("cómic: sin sugerencias (las 200 búsquedas/hora de ComicVine se guardan para el grid)", async () => {
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=batman&type=comic"));
    expect(await res.json()).toEqual([]);
    expect(searchByType).not.toHaveBeenCalled();
  });

  it("un tipo desconocido se trata como sin tipo (cine y series)", async () => {
    vi.mocked(searchMovies).mockResolvedValue({ results: [] } as never);
    vi.mocked(searchTV).mockResolvedValue({ results: [] } as never);
    await searchGET(new NextRequest("http://localhost/api/search?q=dune&type=podcast"));
    expect(searchByType).not.toHaveBeenCalled();
    expect(searchMovies).toHaveBeenCalled();
  });

  it("sin tipo: cine y series por relevancia (Inception antes que Bikini Inception)", async () => {
    vi.mocked(searchMovies).mockResolvedValue({
      results: [
        { id: 1, title: "Bikini Inception", original_title: "Bikini Inception", poster_path: "/b.jpg", vote_average: 5.5, release_date: "2015-01-01", overview: "" },
        { id: 27205, title: "Inception", original_title: "Inception", poster_path: "/i.jpg", vote_average: 8.4, release_date: "2010-07-16", overview: "" },
      ],
    } as never);
    vi.mocked(searchTV).mockResolvedValue({ results: [] } as never);
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=inception"));
    const body = (await res.json()) as MediaItem[];
    expect(body[0].title).toBe("Inception");
  });

  it("si el proveedor de la familia falla → [] y no-store", async () => {
    vi.mocked(searchByType).mockRejectedValue(new Error("MangaDex 503"));
    const res = await searchGET(new NextRequest("http://localhost/api/search?q=naruto&type=manga"));
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/users/search", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("los comodines de LIKE se escapan: buscar '%' no lista a todo el mundo", async () => {
    await usersGET(new NextRequest("http://localhost/api/users/search?q=%25_a"));
    expect(ilike).toHaveBeenCalledWith("username", "%\\%\\_a%");
  });

  it("la consulta se recorta a 40 caracteres", async () => {
    await usersGET(new NextRequest(`http://localhost/api/users/search?q=${"a".repeat(200)}`));
    expect(ilike.mock.calls[0][1]).toBe(`%${"a".repeat(40)}%`);
  });

  it("31 búsquedas en un minuto → la 31.ª es 429 (30/min por usuario)", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await usersGET(new NextRequest("http://localhost/api/users/search?q=ab"))).status).toBe(200);
    }
    const blocked = await usersGET(new NextRequest("http://localhost/api/users/search?q=ab"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("sin usuario autenticado → 401 sin consultar", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await usersGET(new NextRequest("http://localhost/api/users/search?q=ab"));
    expect(res.status).toBe(401);
    expect(ilike).not.toHaveBeenCalled();
  });
});
