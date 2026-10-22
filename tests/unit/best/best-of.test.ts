import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/api/discover", () => ({ fetchDiscoverData: vi.fn() }));

import {
  bestMinVotes,
  bestYears,
  getBestOf,
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

describe("best-of", () => {
  it("publica el año actual y los dos anteriores", () => {
    expect(bestYears(today)).toEqual([2026, 2025, 2024]);
  });

  it("valida formato y año; lo demás es 404", () => {
    expect(parseBestParams("anime", "2026", today)).toEqual({
      format: "anime",
      year: 2026,
    });
    expect(parseBestParams("book", "2026", today)).toBeNull();
    expect(parseBestParams("anime", "2019", today)).toBeNull();
    expect(parseBestParams("anime", "2027", today)).toBeNull();
    expect(parseBestParams("anime", "abc", today)).toBeNull();
  });

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
});

describe("best-of — suelo de votos (E-BEST-VOTOS)", () => {
  it("más exigente en años cerrados; anime no lo usa", () => {
    expect(bestMinVotes("movie", 2026, today)).toBe(400);
    expect(bestMinVotes("movie", 2025, today)).toBe(1500);
    expect(bestMinVotes("tv", 2026, today)).toBe(200);
    expect(bestMinVotes("anime", 2026, today)).toBeUndefined();
    expect(bestMinVotes("game", 2026, today)).toBe(25);
    expect(bestMinVotes("game", 2025, today)).toBe(60);
  });

  it("si el suelo deja menos de 5, repite sin él", async () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item(`m${i}`, { type: "movie" }),
    );
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce({ items: many.slice(0, 2) } as never)
      .mockResolvedValueOnce({ items: many } as never);
    const out = await getBestOf("movie", 2025, "es");
    expect(out).toHaveLength(6);
    const calls = vi.mocked(fetchDiscoverData).mock.calls;
    expect(calls[0][2]).toMatchObject({ minVotes: 1500 });
    expect(calls[1][2]).not.toHaveProperty("minVotes");
  });

  it("juegos: filtra por nº de valoraciones y ordena por valoración", async () => {
    const g = (id: string, mc: number | undefined, rating: number) =>
      item(id, {
        type: "game",
        rating,
        metadata: { ratingsCount: mc },
      } as never);
    vi.mocked(fetchDiscoverData).mockReset();
    vi.mocked(fetchDiscoverData)
      .mockResolvedValueOnce({
        items: [
          g("a", 90, 8.1),
          g("b", 50, 9.9),
          g("c", undefined, 9.8),
          g("d", 80, 9.0),
        ],
      } as never)
      .mockResolvedValueOnce({
        items: [g("e", 75, 8.5), g("f", 71, 7.0), g("h", 88, 8.8)],
      } as never)
      .mockResolvedValue({ items: [] } as never);
    const out = await getBestOf("game", 2024, "es");
    expect(out.map((i) => i.id)).toEqual(["d", "h", "e", "a", "f"]);
  });
});
