// ============================================================
// KULTURA — Muro de la landing: juegos con carátula vertical (DIS-4) y
// etiqueta de caché revalidable.
// ============================================================

import { describe, it, expect, vi } from "vitest";

const { cacheCalls } = vi.hoisted(() => ({ cacheCalls: [] as Array<{ keys: string[]; opts: { tags?: string[] } }> }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: string[], opts: { tags?: string[] }) => {
    cacheCalls.push({ keys, opts });
    return fn;
  },
}));

import {
  CURATED_GAMES,
  curatedGames,
  isLandscapePoster,
  pickShowcase,
  steamCover,
} from "@/lib/landing/showcase";
import { REVALIDATABLE_TAGS, SHOWCASE_CACHE_TAG } from "@/lib/best/cache-tags";
import type { MediaItem } from "@/types/media";

describe("caché de la muestra", () => {
  // Pendiente F-06→F-09: `/api/revalidate` acepta "showcase", pero la muestra
  // se guardaba con la etiqueta "landing-showcase" y no se podía vaciar.
  it("lleva la etiqueta que `/api/revalidate` sabe vaciar", () => {
    expect(cacheCalls).toHaveLength(1);
    expect(cacheCalls[0].opts.tags).toContain(SHOWCASE_CACHE_TAG);
    expect(REVALIDATABLE_TAGS).toContain(cacheCalls[0].opts.tags?.[0]);
  });
});

describe("juegos del muro (DIS-4)", () => {
  it("las capturas de RAWG no entran en la muestra", () => {
    const rawg: MediaItem = {
      id: "game_1",
      externalId: "1",
      type: "game",
      title: "Captura",
      poster: "https://media.rawg.io/media/games/d34/d34853b4f14debc1734a74584bc63d20.jpg",
    };
    const movie: MediaItem = { id: "movie_2", externalId: "2", type: "movie", title: "Peli", poster: "https://image.tmdb.org/t/p/w500/x.jpg" };
    expect(pickShowcase([rawg, movie]).map((i) => i.id)).toEqual(["movie_2"]);
  });

  it("isLandscapePoster reconoce RAWG y nada más", () => {
    expect(isLandscapePoster("https://media.rawg.io/media/screenshots/a.jpg")).toBe(true);
    expect(isLandscapePoster(steamCover(620))).toBe(false);
    expect(isLandscapePoster("https://image.tmdb.org/t/p/w500/a.jpg")).toBe(false);
    expect(isLandscapePoster(undefined)).toBe(false);
    expect(isLandscapePoster("no-es-una-url")).toBe(false);
  });

  it("lista blanca sin duplicados y con ids válidos", () => {
    expect(new Set(CURATED_GAMES.map((g) => g.rawg)).size).toBe(CURATED_GAMES.length);
    expect(new Set(CURATED_GAMES.map((g) => g.steam)).size).toBe(CURATED_GAMES.length);
    for (const g of CURATED_GAMES) {
      expect(Number.isInteger(g.rawg) && g.rawg > 0).toBe(true);
      expect(Number.isInteger(g.steam) && g.steam > 0).toBe(true);
    }
  });

  it("carátula vertical de Steam en un host que admite el optimizador (*.steamstatic.com)", () => {
    const url = new URL(steamCover(292030));
    expect(url.hostname).toMatch(/^[a-z0-9-]+\.steamstatic\.com$/);
    expect(url.pathname).toContain("library_600x900");
  });

  it("los juegos del día son items de catálogo enlazables y rotan cada día", () => {
    const day1 = curatedGames(new Date("2026-10-22T10:00:00Z"));
    const day2 = curatedGames(new Date("2026-10-23T10:00:00Z"));
    expect(day1).toHaveLength(6);
    for (const g of day1) {
      expect(g.type).toBe("game");
      expect(g.id).toBe(`game_${g.externalId}`);
      expect(isLandscapePoster(g.poster)).toBe(false);
    }
    expect(day2[0].id).toBe(day1[1].id);
    // Pasan el filtro de la muestra.
    expect(pickShowcase(day1)).toHaveLength(6);
  });
});
