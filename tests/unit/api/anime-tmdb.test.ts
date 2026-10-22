// ============================================================
// KULTURA — Respaldo de anime con TMDB (E-ANIME-RESPALDO)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/tmdb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/tmdb")>();
  return {
    ...actual,
    discoverTV: vi.fn(),
    searchTV: vi.fn(),
    getTV: vi.fn(),
    getTVVideos: vi.fn(),
  };
});

import { discoverTV, searchTV, getTV, getTVVideos } from "@/lib/api/tmdb";
import {
  buildAnimeTmdbParams,
  discoverAnimeTmdb,
  fromTmdbAnimeRef,
  getAnimeTmdb,
  isTmdbAnime,
  isTmdbAnimeId,
  searchAnimeTmdb,
  toTmdbAnimeRef,
} from "@/lib/api/anime-tmdb";

const tv = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `Serie ${id}`,
  original_name: `Serie ${id}`,
  poster_path: "/p.jpg",
  backdrop_path: null,
  first_air_date: "2026-04-05",
  overview: "Sinopsis",
  vote_average: 8.4,
  genre_ids: [16, 10759],
  origin_country: ["JP"],
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("anime-tmdb — ids", () => {
  it("la referencia tmdb-{id} va y vuelve, y no choca con AniList ni con Jikan", () => {
    expect(toTmdbAnimeRef(123)).toBe("tmdb-123");
    expect(fromTmdbAnimeRef("tmdb-123")).toBe(123);
    expect(isTmdbAnimeId("tmdb-123")).toBe(true);
    expect(isTmdbAnimeId("al-123")).toBe(false);
    expect(isTmdbAnimeId("123")).toBe(false);
  });
});

describe("anime-tmdb — qué cuenta como anime", () => {
  it("exige animación Y origen japonés", () => {
    expect(isTmdbAnime(tv(1))).toBe(true);
    expect(isTmdbAnime(tv(2, { genre_ids: [18] }))).toBe(false);
    expect(isTmdbAnime(tv(3, { origin_country: ["US"] }))).toBe(false);
    expect(isTmdbAnime(tv(4, { origin_country: [], original_language: "ja" }))).toBe(true);
  });
});

describe("anime-tmdb — params de Descubrir", () => {
  it("animación japonesa, con año, orden y suelo de votos rebajado", () => {
    const p = buildAnimeTmdbParams({ year: "2026", sort: "rating" });
    expect(p.with_genres).toBe("16");
    expect(p.with_origin_country).toBe("JP");
    expect(p["vote_count.gte"]).toBe("20");
    expect(p["first_air_date.gte"]).toBe("2026-01-01");
    expect(p.sort_by).toMatch(/vote_average/);
  });
});

describe("anime-tmdb — normalización", () => {
  it("Descubrir devuelve items de tipo anime con id anime_tmdb-{id}", async () => {
    vi.mocked(discoverTV).mockResolvedValue({ results: [tv(7)], total_pages: 4 } as never);
    const r = await discoverAnimeTmdb(1, { year: "2026", sort: "rating" }, "es");
    expect(r.totalPages).toBe(4);
    expect(r.items[0]).toMatchObject({
      id: "anime_tmdb-7",
      externalId: "tmdb-7",
      type: "anime",
      title: "Serie 7",
    });
  });

  it("el buscador descarta lo que no es anime", async () => {
    vi.mocked(searchTV).mockResolvedValue({
      results: [tv(1), tv(2, { genre_ids: [18], origin_country: ["US"] })],
      total_pages: 1,
    } as never);
    const r = await searchAnimeTmdb("x", 1, "es");
    expect(r.items.map((i) => i.id)).toEqual(["anime_tmdb-1"]);
  });

  it("la ficha resuelve item y tráiler; sin detalle devuelve null", async () => {
    vi.mocked(getTV).mockResolvedValue({ ...tv(9), genres: [{ id: 16, name: "Animación" }] } as never);
    vi.mocked(getTVVideos).mockResolvedValue({
      results: [{ key: "abc", site: "YouTube", type: "Trailer" }],
    } as never);
    const r = await getAnimeTmdb("tmdb-9", "es");
    expect(r?.item.type).toBe("anime");
    expect(r?.trailerKey).toBe("abc");

    vi.mocked(getTV).mockRejectedValue(new Error("404"));
    expect(await getAnimeTmdb("tmdb-9", "es")).toBeNull();
  });
});
