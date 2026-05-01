/**
 * Test de contrato — RAWG API (videojuegos)
 * Requiere NEXT_PUBLIC_RAWG_KEY en .env.local
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_KEY ?? "";
const BASE = "https://api.rawg.io/api";

// ── Schemas ───────────────────────────────────────────────────────────────────

const RawgGameSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  released: z.string().nullable(),
  background_image: z.string().nullable(),
  rating: z.number(),
  rating_top: z.number(),
  ratings_count: z.number(),
  genres: z.array(z.object({ id: z.number(), name: z.string(), slug: z.string() })).optional(),
  platforms: z
    .array(
      z.object({
        platform: z.object({ id: z.number(), name: z.string() }),
      })
    )
    .nullable()
    .optional(),
});

const RawgSearchResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(RawgGameSchema),
});

const RawgGameDetailSchema = RawgGameSchema.extend({
  description_raw: z.string().nullable().optional(),
  metacritic: z.number().nullable().optional(),
  developers: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
  publishers: z
    .array(z.object({ id: z.number(), name: z.string() }))
    .optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rawgFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`RAWG ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RAWG contract — /games?search=", () => {
  it("shape de búsqueda coincide con RawgSearchResponseSchema", async () => {
    const data = await rawgFetch("/games?search=the+witcher&page_size=5");
    const result = RawgSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("devuelve al menos 1 resultado para 'the witcher'", async () => {
    const data = await rawgFetch("/games?search=the+witcher&page_size=5");
    const result = RawgSearchResponseSchema.parse(data);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("background_image es string o null (nunca undefined)", async () => {
    const data = await rawgFetch("/games?search=the+witcher&page_size=5");
    const result = RawgSearchResponseSchema.parse(data);
    for (const game of result.results.slice(0, 5)) {
      expect(
        game.background_image === null || typeof game.background_image === "string"
      ).toBe(true);
    }
  });

  it("rating es un número entre 0 y 5", async () => {
    const data = await rawgFetch("/games?search=the+witcher&page_size=5");
    const result = RawgSearchResponseSchema.parse(data);
    for (const game of result.results.slice(0, 5)) {
      expect(game.rating).toBeGreaterThanOrEqual(0);
      expect(game.rating).toBeLessThanOrEqual(5);
    }
  });
});

describe("RAWG contract — /games/{id} (detalle)", () => {
  const GAME_ID = 3498; // God of War — id estable en RAWG

  it("shape de detalle coincide con RawgGameDetailSchema", async () => {
    const data = await rawgFetch(`/games/${GAME_ID}`);
    const result = RawgGameDetailSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("nombre del juego es un string no vacío", async () => {
    const data = await rawgFetch(`/games/${GAME_ID}`);
    const result = RawgGameDetailSchema.parse(data);
    expect(result.name.length).toBeGreaterThan(0);
  });
});
