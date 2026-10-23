// ============================================================
// KULTURA — Media ponderada en los rankings (F-13, DAT-4)
//
// Medido en producción: tv/2026 #1 "Dragon Ball Super: Beerus" ★9,7 con
// pocos votos tempranos de fans; "Adolescencia" (miles de votos) por debajo.
// Con `WR = v/(v+m)·R + m/(v+m)·C` un título de nicho no encabeza el top-5.
// ============================================================

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

import { computeSelection } from "@/lib/best/best-of";
import { rankingScore, weightedRating, WEIGHTED_PRIOR } from "@/lib/best/quality";
import { fetchDiscoverData } from "@/lib/api/discover";
import type { MediaItem } from "@/types/media";

const today = new Date("2026-10-21");
const tv = (id: string, rating: number, voteCount: number): MediaItem => ({
  id,
  externalId: id,
  type: "tv",
  title: id,
  poster: "https://x/p.jpg",
  rating,
  synopsis: "s",
  genres: ["Drama"],
  metadata: { originCountry: ["US"], voteCount },
});
const ok = (items: MediaItem[]) => ({ items, totalPages: 1, hasMore: false, fetchErrorKind: null });

beforeEach(() => {
  vi.mocked(fetchDiscoverData).mockReset();
});

describe("weightedRating", () => {
  it("con muchos votos tiende a la nota propia; con pocos, a la media", () => {
    const { m, c } = WEIGHTED_PRIOR.tv;
    expect(weightedRating(8, 100_000, m, c)).toBeCloseTo(8, 1);
    expect(weightedRating(9.7, 10, m, c)).toBeCloseTo(6.56, 2);
    expect(weightedRating(9, 0, m, c)).toBe(c);
  });

  it("sin votos conocidos, el orden es por nota (cine hasta que el normalizador traiga vote_count)", () => {
    expect(rankingScore("movie", { id: "x", externalId: "x", type: "movie", title: "x", rating: 8.2 })).toBe(8.2);
    expect(rankingScore("anime", { id: "x", externalId: "x", type: "anime", title: "x", rating: 8.9, metadata: { voteCount: 5 } })).toBe(8.9);
  });
});

describe("rankings con media ponderada", () => {
  it("series del año en curso: ningún título con < 300 votos en el top-5", async () => {
    // Orden del proveedor: por nota (vote_average.desc) con el suelo de votos.
    vi.mocked(fetchDiscoverData).mockResolvedValue(
      ok([
        tv("Dragon Ball Super: Beerus", 9.7, 310),
        tv("Así aprenderás", 9.4, 305),
        tv("Nicho A", 9.2, 320),
        tv("Nicho B", 9.1, 330),
        tv("Adolescencia", 8.1, 2_400),
        tv("The Pitt", 8.6, 1_900),
        tv("Severance", 8.4, 3_100),
        tv("The Bear", 8.0, 2_800),
        tv("Andor", 8.3, 2_000),
      ]) as never,
    );
    const s = await computeSelection("tv", 2026, "es", today);
    const top5 = s.items.slice(0, 5).map((i) => i.id);
    expect(top5).toEqual(["The Pitt", "Severance", "Andor", "Adolescencia", "The Bear"]);
    // La nota que se PINTA sigue siendo la propia.
    expect(s.items.find((i) => i.id === "The Pitt")?.rating).toBe(8.6);
  });

  it("la nota mínima (7) se aplica a la nota propia, no a la ponderada", async () => {
    vi.mocked(fetchDiscoverData).mockResolvedValue(
      ok([tv("Popular floja", 6.8, 50_000), tv("Buena", 7.4, 600)]) as never,
    );
    const s = await computeSelection("tv", 2025, "es", today);
    expect(s.items.map((i) => i.id)).toEqual(["Buena"]);
  });
});
