// ============================================================
// KULTURA — Caracterización del banco de relevancia (F-32)
//
// El banco de F-13 (`search/relevance-providers.test.ts`) comprueba el
// primero de cada consulta. Esta foto guarda el ORDEN COMPLETO y la
// puntuación de cada candidato en las 50 consultas, por el camino de
// producción (`searchByTypePaged` → normalizador real → orden), para que
// mover código del catálogo no cambie ni una posición sin que se vea.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import {
  ANIME_CASES,
  BOOK_CASES,
  GAME_CASES,
  MOVIE_CASES,
  TV_CASES,
} from "../search/fixtures/provider-search";

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
import { relevanceScore } from "@/lib/api/search-rank";
import type { MediaType } from "@/types/media";

describe.each([
  ["movie", MOVIE_CASES],
  ["tv", TV_CASES],
  ["anime", ANIME_CASES],
  ["book", BOOK_CASES],
  ["game", GAME_CASES],
] as [MediaType, [string, unknown[], unknown][]][])("orden completo %s", (type, cases) => {
  it.each(cases.map(([q, raw]) => [q, raw] as const))("%s", async (query, raw) => {
    responses.current = raw;
    const res = await searchByTypePaged(query, type, 1, "es");
    const rows = res.items.map(
      (item, i) => `${item.id} · ${item.title} · ${relevanceScore(query, item, i).toFixed(3)}`
    );
    expect(rows).toMatchSnapshot();
  });
});
