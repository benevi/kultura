// ============================================================
// Cupo de CPU de Vercel Hobby: las tarjetas del sitio y de los rankings se
// guardan en la CDN (`s-maxage`). Sin él, `ImageResponse` responde con
// `max-age` de un año pero SIN `s-maxage`, la CDN no la guarda y cada bot de
// vista previa la volvía a pintar con satori.
//   - tarjeta completa → caché larga;
//   - a medias (sin tipografía, sin portadas) → la caché corta de siempre.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  responses: [] as Array<{ options: Record<string, unknown> }>,
  fontOk: true,
  posterOk: true,
  getBestOf: vi.fn(),
}));

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(_element: unknown, options: Record<string, unknown>) {
      h.responses.push({ options });
    }
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => {
    const t = (key: string) => (key === "hero.sub" ? "Una cosa. Gratis y sin anuncios." : key);
    t.raw = () => "Tu cine, tus series";
    return t;
  },
}));
vi.mock("@/lib/og/brand", async (orig) => ({
  ...(await orig<typeof import("@/lib/og/brand")>()),
  loadFont: async (family: string) =>
    h.fontOk ? { name: family, data: new ArrayBuffer(1), weight: 800 as const, style: "normal" as const } : null,
}));
vi.mock("@/lib/og/poster", () => ({ posterDataUri: async (src: string) => (h.posterOk ? `data:${src}` : null) }));
vi.mock("@/lib/best/best-of", async (orig) => ({
  ...(await orig<typeof import("@/lib/best/best-of")>()),
  getBestOf: h.getBestOf,
}));

import SiteCard from "@/app/[locale]/opengraph-image";
import RankingCard from "@/app/[locale]/best/[format]/[year]/opengraph-image";
import { OG_DEGRADED_CACHE_CONTROL, OG_RANKING_CACHE_CONTROL, OG_SITE_CACHE_CONTROL } from "@/lib/og/brand";

const cacheOf = (i = 0) => (h.responses[i].options.headers as Record<string, string>)["cache-control"];
const items = [1, 2, 3].map((n) => ({ title: `T${n}`, poster: `p${n}` }));

beforeEach(() => {
  h.responses.length = 0;
  h.fontOk = true;
  h.posterOk = true;
  h.getBestOf.mockReset();
});

describe("caché de las tarjetas del sitio y de los rankings", () => {
  it("las cabeceras largas llevan s-maxage (la CDN solo guarda con él) y nunca private", () => {
    for (const cc of [OG_SITE_CACHE_CONTROL, OG_RANKING_CACHE_CONTROL, OG_DEGRADED_CACHE_CONTROL]) {
      expect(cc).toMatch(/(^|, )public(,|$)/);
      expect(cc).toMatch(/s-maxage=\d+/);
      expect(cc).not.toMatch(/private|no-store|no-cache|immutable/);
    }
  });

  it("tarjeta del sitio completa: caché larga", async () => {
    await SiteCard({ params: { locale: "es" } });
    expect(cacheOf()).toBe(OG_SITE_CACHE_CONTROL);
  });

  it("tarjeta del sitio sin tipografía: caché corta", async () => {
    h.fontOk = false;
    await SiteCard({ params: Promise.resolve({ locale: "en" }) });
    expect(cacheOf()).toBe(OG_DEGRADED_CACHE_CONTROL);
  });

  it("ranking con sus tres portadas: caché de ranking", async () => {
    h.getBestOf.mockResolvedValue(items);
    await RankingCard({ params: { locale: "es", format: "movie", year: "2025" } });
    expect(cacheOf()).toBe(OG_RANKING_CACHE_CONTROL);
  });

  it("ranking sin portadas o sin datos: caché corta", async () => {
    h.posterOk = false;
    h.getBestOf.mockResolvedValue(items);
    await RankingCard({ params: { locale: "es", format: "movie", year: "2025" } });
    h.posterOk = true;
    h.getBestOf.mockRejectedValue(new Error("proveedor caído"));
    await RankingCard({ params: { locale: "es", format: "movie", year: "2025" } });
    expect(cacheOf(0)).toBe(OG_DEGRADED_CACHE_CONTROL);
    expect(cacheOf(1)).toBe(OG_DEGRADED_CACHE_CONTROL);
  });
});
