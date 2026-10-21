import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/api/discover", () => ({ fetchDiscoverData: vi.fn() }));

import { bestYears, parseBestParams, pickBest } from "@/lib/best/best-of";
import type { MediaItem } from "@/types/media";

const today = new Date("2026-10-21");
const item = (id: string, over: Partial<MediaItem> = {}): MediaItem => ({
  id, externalId: id, type: "anime", title: id, poster: "https://x/p.jpg", ...over,
});

describe("best-of", () => {
  it("publica el año actual y los dos anteriores", () => {
    expect(bestYears(today)).toEqual([2026, 2025, 2024]);
  });

  it("valida formato y año; lo demás es 404", () => {
    expect(parseBestParams("anime", "2026", today)).toEqual({ format: "anime", year: 2026 });
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
