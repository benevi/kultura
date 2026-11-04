// ============================================================
// KULTURA — Reparto de las imágenes de la landing v2 y su respaldo
// ============================================================

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { FALLBACK_MEDIA, RANKING_FORMATS, buildLandingScenes, formatRating } from "@/lib/landing/scenes";
import type { LandingMedia } from "@/lib/landing/media";

const weekly = (slot: LandingMedia["slot"], position: number, format = "movie"): LandingMedia => ({
  ...FALLBACK_MEDIA[0],
  slot,
  position,
  format,
  type: format,
  title: `${slot}-${position}`,
  image: `https://x.supabase.co/storage/v1/object/public/landing/2026-11-09/${slot}-${position}.jpg`,
  depth: `https://x.supabase.co/storage/v1/object/public/landing/2026-11-09/${slot}-${position}_d.jpg`,
});

describe("respaldo fijo", () => {
  it("cada imagen y su mapa de profundidad existen en public/", () => {
    for (const m of FALLBACK_MEDIA) {
      expect(existsSync(resolve(__dirname, "../../../public", `.${m.image}`)), m.image).toBe(true);
      expect(existsSync(resolve(__dirname, "../../../public", `.${m.depth}`)), m.depth).toBe(true);
    }
  });

  it("sin filas de la semana, la landing sale entera con el respaldo", () => {
    const s = buildLandingScenes([]);
    expect(s.hero).toHaveLength(3);
    expect(s.feature).toHaveLength(4);
    expect(s.step).toHaveLength(3);
    for (const f of RANKING_FORMATS) expect(s.ranking[f].format).toBe(f);
    expect([...s.hero, ...s.feature, ...s.step].every((m) => m.image.startsWith("/landing/fallback/"))).toBe(true);
  });
});

describe("imágenes de la semana", () => {
  it("se usan por orden de posición y lo que falta se completa con el respaldo", () => {
    const s = buildLandingScenes([weekly("hero", 1), weekly("hero", 0), weekly("ranking", 0, "tv")]);
    expect(s.hero.map((m) => m.title)).toEqual(["hero-0", "hero-1", FALLBACK_MEDIA[2].title]);
    expect(s.ranking.tv.title).toBe("ranking-0");
    expect(s.ranking.anime.image.startsWith("/landing/fallback/")).toBe(true);
  });
});

describe("nota", () => {
  it("con el separador decimal del idioma", () => {
    expect(formatRating(9, "es")).toBe("9,0");
    expect(formatRating(8.75, "en")).toBe("8.8");
    expect(formatRating(null, "es")).toBeNull();
  });
});
