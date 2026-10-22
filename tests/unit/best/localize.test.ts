import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/translate/synopsis", () => ({ translateSynopsis: vi.fn() }));
vi.mock("@/lib/api/anime-tmdb", () => ({ searchAnimeTmdb: vi.fn() }));
vi.mock("@/lib/api/rawg", () => ({ getGame: vi.fn() }));
vi.mock("@/lib/api/steam", () => ({
  getSteamAppDetails: vi.fn(),
  steamAppIdFromRawgGame: vi.fn(),
}));

import { localizeRanking, type BestSource } from "@/lib/best/localize";
import { translateSynopsis } from "@/lib/translate/synopsis";
import { searchAnimeTmdb } from "@/lib/api/anime-tmdb";
import { getGame } from "@/lib/api/rawg";
import { getSteamAppDetails, steamAppIdFromRawgGame } from "@/lib/api/steam";

const EN = "The heroes travel across the world and they fight the demon king in the north.";
const ES = "Los héroes viajan por el mundo y luchan contra el rey demonio en el norte.";

const src = (over: Partial<BestSource>): BestSource => ({
  id: "anime_al-1",
  externalId: "al-1",
  type: "anime",
  title: "Frieren: Beyond Journey's End",
  originalTitle: "Sousou no Frieren",
  nativeTitle: "葬送のフリーレン",
  poster: "https://x/p.jpg",
  year: 2023,
  rating: 9.1,
  genres: ["Adventure", "Drama", "Fantasy"],
  synopsis: EN,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchAnimeTmdb).mockResolvedValue({ items: [], totalPages: 1 });
  vi.mocked(translateSynopsis).mockImplementation(async ({ text }) => text ?? "");
});

describe("localizeRanking — anime en /es (DAT-5)", () => {
  it("título y sinopsis de TMDB cuando el título japonés coincide exacto", async () => {
    vi.mocked(searchAnimeTmdb).mockResolvedValue({
      totalPages: 1,
      items: [
        {
          id: "anime_tmdb-209867",
          externalId: "tmdb-209867",
          type: "anime",
          title: "Frieren: Más allá del final del viaje",
          originalTitle: "葬送のフリーレン",
          synopsis: ES,
        },
      ],
    });
    const [out] = await localizeRanking([src({})], "es");
    expect(out.title).toBe("Frieren: Más allá del final del viaje");
    expect(out.synopsis).toBe(ES);
    expect(out.genres).toEqual(["Aventura", "Drama", "Fantasía"]);
    expect(translateSynopsis).not.toHaveBeenCalled();
  });

  it("una temporada suelta no casa con la serie de TMDB: conserva su título y traduce", async () => {
    vi.mocked(searchAnimeTmdb).mockResolvedValue({
      totalPages: 1,
      items: [
        {
          id: "anime_tmdb-1",
          externalId: "tmdb-1",
          type: "anime",
          title: "Re:Zero, empezar de cero",
          originalTitle: "Re:ゼロから始める異世界生活",
          synopsis: ES,
        },
      ],
    });
    vi.mocked(translateSynopsis).mockImplementation(async ({ text, cacheOnly }) =>
      cacheOnly ? (text ?? "") : ES
    );
    const [out] = await localizeRanking(
      [src({ title: "Re:ZERO Season 3", nativeTitle: "Re:ゼロから始める異世界生活 3rd season" })],
      "es"
    );
    expect(out.title).toBe("Re:ZERO Season 3");
    expect(out.synopsis).toBe(ES);
  });

  it("en /en no pregunta a TMDB ni traduce", async () => {
    const [out] = await localizeRanking([src({})], "en");
    expect(searchAnimeTmdb).not.toHaveBeenCalled();
    expect(translateSynopsis).not.toHaveBeenCalled();
    expect(out.title).toBe("Frieren: Beyond Journey's End");
    expect(out.genres).toEqual(["Adventure", "Drama", "Fantasy"]);
  });

  it("TMDB caído: se pinta lo de AniList", async () => {
    vi.mocked(searchAnimeTmdb).mockRejectedValue(new Error("TMDB 503"));
    const [out] = await localizeRanking([src({})], "es", 0);
    expect(out.title).toBe("Frieren: Beyond Journey's End");
  });
});

describe("localizeRanking — presupuesto de traducción (D-06)", () => {
  it("todo pasa primero por la caché y solo `budget` llegan al modelo, en orden", async () => {
    vi.mocked(translateSynopsis).mockImplementation(async ({ text, cacheOnly }) =>
      cacheOnly ? (text ?? "") : ES
    );
    const items = Array.from({ length: 5 }, (_, i) =>
      src({ id: `anime_al-${i}`, externalId: `al-${i}`, nativeTitle: undefined })
    );
    const out = await localizeRanking(items, "es", 2);
    const calls = vi.mocked(translateSynopsis).mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c.cacheOnly)).toHaveLength(5);
    const paid = calls.filter((c) => !c.cacheOnly);
    expect(paid.map((c) => c.mediaId)).toEqual(["anime_al-0", "anime_al-1"]);
    expect(out.map((o) => o.synopsis === ES)).toEqual([true, true, false, false, false]);
  });
});

describe("localizeRanking — misma caché de traducción que la ficha", () => {
  it("traduce el texto COMPLETO con el id de la ficha y recorta después", async () => {
    const long = `${EN} `.repeat(12).trim() + "\n\n(Source: Crunchyroll)";
    expect(long.length).toBeGreaterThan(480);
    vi.mocked(translateSynopsis).mockImplementation(async ({ text, cacheOnly }) =>
      cacheOnly ? (text ?? "") : `${ES} `.repeat(12).trim() + "\n\n(Fuente: Crunchyroll)"
    );
    const [out] = await localizeRanking([src({ synopsis: long, nativeTitle: undefined })], "es");
    const calls = vi.mocked(translateSynopsis).mock.calls.map((c) => c[0]);
    expect(calls.every((c) => c.text === long && c.mediaId === "anime_al-1")).toBe(true);
    expect(out.synopsis!.length).toBeLessThanOrEqual(480);
    expect(out.synopsis).not.toMatch(/Fuente|Source/);
    expect(out.synopsis!.startsWith("Los héroes")).toBe(true);
  });
});

describe("localizeRanking — sinopsis de juegos", () => {
  const game = src({
    id: "game_58175",
    externalId: "58175",
    type: "game",
    title: "God of War",
    nativeTitle: undefined,
    synopsis: undefined,
    genres: ["Action", "Adventure"],
  });

  it("usa la descripción corta de Steam en el idioma pedido", async () => {
    vi.mocked(getGame).mockResolvedValue({ id: 58175, description_raw: EN } as never);
    vi.mocked(steamAppIdFromRawgGame).mockReturnValue(1593500);
    vi.mocked(getSteamAppDetails).mockResolvedValue({ type: "game", short_description: ES } as never);
    const [out] = await localizeRanking([game], "es");
    expect(getSteamAppDetails).toHaveBeenCalledWith(1593500, "es");
    expect(out.synopsis).toBe(ES);
    expect(out.genres).toEqual(["Acción", "Aventura"]);
  });

  it("sin Steam, la de RAWG (y se traduce dentro del presupuesto)", async () => {
    vi.mocked(getGame).mockResolvedValue({ id: 58175, description_raw: EN } as never);
    vi.mocked(steamAppIdFromRawgGame).mockReturnValue(null);
    vi.mocked(translateSynopsis).mockImplementation(async ({ text, cacheOnly }) =>
      cacheOnly ? (text ?? "") : ES
    );
    const [out] = await localizeRanking([game], "es");
    expect(out.synopsis).toBe(ES);
  });

  it("RAWG caído: la card sale sin sinopsis, no rota", async () => {
    vi.mocked(getGame).mockRejectedValue(new Error("RAWG 502"));
    const [out] = await localizeRanking([game], "es");
    expect(out.synopsis).toBeUndefined();
    expect(out.title).toBe("God of War");
  });
});
