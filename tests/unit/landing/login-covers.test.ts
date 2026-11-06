import { describe, expect, it } from "vitest";
import { buildLoginCovers, LOGIN_TOUR, sceneColor, type LoginFormat } from "@/lib/landing/login-covers";
import type { LandingMedia } from "@/lib/landing/media";

const LABELS = Object.fromEntries(LOGIN_TOUR.map((f) => [f, f.toUpperCase()])) as Record<LoginFormat, string>;

function lum(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("sceneColor", () => {
  it("un acento sin color pasa a tinta", () => {
    expect(sceneColor("#808080")).toBe("#f2f2f0");
    expect(sceneColor("#604b4c")).toBe("#f2f2f0");
  });

  it("cualquier acento da contraste con la tinta negra del botón", () => {
    for (const hex of ["#0b93a9", "#592e7c", "#404163", "#f1a231", "#19a2d6", "#c7605a"]) {
      const c = sceneColor(hex);
      if (c.startsWith("rgb")) expect((lum(c) + 0.05) / 0.053).toBeGreaterThanOrEqual(6);
    }
  });

  it("el violeta se lleva a un azul", () => {
    const [r, g, b] = sceneColor("#592e7c").match(/[0-9]+/g)!.map(Number);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it("el terracota se lleva a ámbar", () => {
    const [r, g, b] = sceneColor("#d2714a").match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r - b).toBeGreaterThan(150);
  });
});

describe("buildLoginCovers", () => {
  it("sin imágenes de la semana recorre los siete formatos dos veces con el respaldo", () => {
    const covers = buildLoginCovers([], LABELS);
    expect(covers.map((c) => c.format)).toEqual([...LOGIN_TOUR, ...LOGIN_TOUR]);
    expect(covers[0].label).toBe("MOVIE");
    expect(covers.every((c) => c.image.startsWith("/landing/fallback/"))).toBe(true);
  });

  it("libros y cómics salen planos, sin mapa de profundidad", () => {
    const covers = buildLoginCovers([], LABELS);
    expect(covers.filter((c) => c.format === "book" || c.format === "comic").every((c) => c.depth === null)).toBe(true);
    expect(covers.filter((c) => c.format === "movie").every((c) => c.depth !== null)).toBe(true);
  });

  it("las imágenes de la semana mandan sobre el respaldo", () => {
    const week = { type: "movie", title: "Nueva", image: "https://x/n.jpg", depth: "https://x/n_d.jpg", width: 640, height: 960, threshold: 0.5, focus: [0.5, 0.5], accent: "#0b93a9" } as unknown as LandingMedia;
    const covers = buildLoginCovers([week], LABELS);
    expect(covers.find((c) => c.format === "movie")?.title).toBe("Nueva");
  });

  it("las claves no se repiten", () => {
    const covers = buildLoginCovers([], LABELS);
    expect(new Set(covers.map((c) => c.key)).size).toBe(covers.length);
  });
});
