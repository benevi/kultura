// @vitest-environment node
// ============================================================
// KULTURA — Banco de relevancia con respuestas de proveedor realistas (F-13)
//
// 50 consultas (cine, series, anime, libros y juegos), cada una con 10-14
// candidatos con la forma REAL de la respuesta del proveedor
// (`fixtures/provider-search.ts`) y en un orden de proveedor verosímil.
// Pasan por el camino de producción completo: `searchByTypePaged` →
// normalizador real → `rankSearchResults`. Solo se sustituye la red.
//
// Aceptación: top-1 ≥ 95 % por familia. Además se comprueba que el banco no
// se aprueba solo: en la mayoría de consultas el primero del proveedor NO es
// la obra.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import {
  ANIME_CASES,
  BOOK_CASES,
  GAME_CASES,
  MOVIE_CASES,
  TV_CASES,
} from "./fixtures/provider-search";

const responses = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/api/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/tmdb")>()),
  searchMovies: vi.fn(async () => ({ results: responses.current, total_pages: 1 })),
  searchTV: vi.fn(async () => ({ results: responses.current, total_pages: 1 })),
}));
vi.mock("@/lib/api/anilist", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/anilist")>()),
  searchAnime: vi.fn(async () => ({ media: responses.current, pageInfo: { lastPage: 1 } })),
}));
vi.mock("@/lib/api/openlibrary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/openlibrary")>()),
  searchOpenLibrary: vi.fn(async () => ({ docs: responses.current, numFound: 10 })),
}));
vi.mock("@/lib/api/rawg", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rawg")>()),
  searchGames: vi.fn(async () => ({ results: responses.current, count: 10 })),
}));

import { searchByTypePaged } from "@/lib/api/search";
import type { MediaItem, MediaType } from "@/types/media";

type Check = RegExp | ((r: { title: string; year?: number }) => boolean);

function hit(item: MediaItem | undefined, check: Check): boolean {
  if (!item) return false;
  if (typeof check === "function") return check({ title: item.title, year: item.year });
  return check.test(item.title) || check.test(item.originalTitle ?? "");
}

async function runBank(type: MediaType, cases: [string, unknown[], Check][]) {
  const misses: string[] = [];
  let providerFirstWrong = 0;
  for (const [query, raw, check] of cases) {
    responses.current = raw;
    const res = await searchByTypePaged(query, type, 1, "es");
    const nativeFirst = (await (async () => {
      // El primero del proveedor, normalizado igual (sin reordenar).
      responses.current = raw.slice(0, 1);
      return (await searchByTypePaged(query, type, 1, "es")).items[0];
    })());
    if (!hit(nativeFirst, check)) providerFirstWrong++;
    if (!hit(res.items[0], check)) misses.push(`${query} → ${res.items[0]?.title}`);
    expect(res.items.length).toBeGreaterThanOrEqual(10);
  }
  return { misses, providerFirstWrong, n: cases.length };
}

describe.each([
  ["movie", MOVIE_CASES],
  ["tv", TV_CASES],
  ["anime", ANIME_CASES],
  ["book", BOOK_CASES],
  ["game", GAME_CASES],
] as [MediaType, [string, unknown[], Check][]][])("relevancia %s (10 consultas, 10-14 candidatos)", (type, cases) => {
  it("top-1 correcto ≥ 95 %, y el banco no se aprueba solo", async () => {
    const { misses, providerFirstWrong, n } = await runBank(type, cases);
    expect(misses.length / n, misses.join("; ")).toBeLessThanOrEqual(0.05);
    expect(misses).toEqual([]);
    // En al menos 7 de 10 el proveedor NO pone la obra primera: el banco mide
    // el reordenado, no el orden de origen.
    expect(providerFirstWrong).toBeGreaterThanOrEqual(7);
  });
});

describe("detalles del orden con respuestas realistas", () => {
  it("cine: el título original cuenta («inception» → Origen) y sin portada va al final", async () => {
    responses.current = MOVIE_CASES.find(([q]) => q === "inception")![1];
    const res = await searchByTypePaged("inception", "movie", 1, "es");
    expect(res.items[0].title).toBe("Origen");
    expect(res.items[res.items.length - 1].poster).toBeUndefined();
  });

  it("anime: secuelas y temporadas detrás de la primera («frieren», «attack on titan»)", async () => {
    responses.current = ANIME_CASES.find(([q]) => q === "attack on titan")![1];
    const res = await searchByTypePaged("attack on titan", "anime", 1, "es");
    expect(res.items[0].title).toBe("Attack on Titan");
    const firstSeason = res.items.findIndex((i) => /season/i.test(i.title));
    const spinoff = res.items.findIndex((i) => i.title === "Attack on Titan: No Regrets");
    expect(spinoff).toBeLessThan(firstSeason);
  });

  it("libros: la edición en el idioma de la consulta antes que la original en inglés", async () => {
    responses.current = BOOK_CASES.find(([q]) => q === "el hobbit")![1];
    const res = await searchByTypePaged("el hobbit", "book", 1, "es");
    expect(res.items.map((i) => i.title).slice(0, 2)).toEqual(["El hobbit", "The Hobbit"]);
  });

  it("juegos: con número en la consulta no se penaliza la secuela («portal 2»)", async () => {
    responses.current = GAME_CASES.find(([q]) => q === "portal 2")![1];
    const res = await searchByTypePaged("portal 2", "game", 1, "es");
    expect(res.items[0].title).toBe("Portal 2");
  });
});
