/**
 * F-22 (revisión #47) — URL de rankings válidas, decididas en el edge.
 * `isInvalidBestPath` (src/lib/csp.ts, apta para el middleware) tiene que
 * decir exactamente lo mismo que `parseBestParams`/`isBestFormat` de
 * src/lib/best/best-of.ts, que es lo que acaba validando la página.
 */
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));

import { isInvalidBestPath } from "@/lib/csp";
import { BEST_FIRST_YEAR, BEST_FORMATS, isBestFormat, parseBestParams } from "@/lib/best/best-of";

const TODAY = new Date("2026-10-26T12:00:00Z");

describe("isInvalidBestPath", () => {
  it.each([
    "/es/best",
    "/en/best/",
    "/es/best/anime",
    "/es/best/movie/2026",
    "/en/best/game/2024",
    "/es/best/tv/2025/",
    "/es/best/movie/2026/opengraph-image",
    "/es/best/movie/2026/opengraph-image-1a2b3c",
  ])("%s existe", (path) => {
    expect(isInvalidBestPath(path, TODAY)).toBe(false);
  });

  it.each([
    "/es/best/book",
    "/es/best/movie/abc",
    "/es/best/movie/26",
    "/es/best/movie/2023",
    "/es/best/movie/2027",
    "/es/best/movie/2026/extra",
    "/es/best/movie/2026/opengraph-image/x",
    "/es/best/MOVIE/2026",
  ])("%s no existe (404 dinámica, sin entrada en la caché ISR)", (path) => {
    expect(isInvalidBestPath(path, TODAY)).toBe(true);
  });

  it("solo opina de /best: el resto de rutas no son suyas", () => {
    for (const p of ["/es", "/es/bestias", "/es/login", "/es/best-x/movie"]) {
      expect(isInvalidBestPath(p, TODAY)).toBe(false);
    }
  });

  it("dice lo mismo que best-of.ts para todo formato y año candidato", () => {
    const formats = [...BEST_FORMATS, "book", "comic", "anime2"];
    for (const f of formats) {
      expect(isInvalidBestPath(`/es/best/${f}`, TODAY)).toBe(!isBestFormat(f));
      for (let y = BEST_FIRST_YEAR - 2; y <= TODAY.getFullYear() + 2; y++) {
        expect(isInvalidBestPath(`/es/best/${f}/${y}`, TODAY)).toBe(parseBestParams(f, String(y), TODAY) === null);
      }
    }
  });
});
