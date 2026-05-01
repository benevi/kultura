/**
 * Test de contrato — Jikan v4 API (MyAnimeList)
 * Sin API key requerida.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const BASE = "https://api.jikan.moe/v4";

// ── Schemas ───────────────────────────────────────────────────────────────────

const JikanAnimeSchema = z.object({
  mal_id: z.number(),
  title: z.string(),
  title_english: z.string().nullable().optional(),
  images: z.object({
    jpg: z.object({
      image_url: z.string().nullable(),
      large_image_url: z.string().nullable().optional(),
    }),
  }),
  synopsis: z.string().nullable(),
  score: z.number().nullable(),
  year: z.number().nullable(),
  episodes: z.number().nullable(),
  genres: z.array(z.object({ mal_id: z.number(), name: z.string() })),
  status: z.string().nullable().optional(),
  aired: z.object({ from: z.string().nullable() }).optional(),
});

const JikanSearchResponseSchema = z.object({
  data: z.array(JikanAnimeSchema),
  pagination: z.object({
    last_visible_page: z.number(),
    has_next_page: z.boolean(),
    current_page: z.number(),
  }),
});

const JikanAnimeDetailSchema = z.object({
  data: JikanAnimeSchema,
});

const JikanVideosSchema = z.object({
  data: z.object({
    promo: z
      .array(
        z.object({
          title: z.string(),
          trailer: z.object({
            youtube_id: z.string().nullable(),
          }),
        })
      )
      .optional(),
    episodes: z
      .array(
        z.object({
          title: z.string().optional(),
          episode: z.string().optional(),
        })
      )
      .optional(),
  }),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function jikanFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Jikan ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Jikan contract — /anime?q=", () => {
  it("shape de búsqueda coincide con JikanSearchResponseSchema", async () => {
    const data = await jikanFetch("/anime?q=naruto&limit=5");
    const result = JikanSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("devuelve al menos 1 resultado para 'naruto'", async () => {
    const data = await jikanFetch("/anime?q=naruto&limit=5");
    const result = JikanSearchResponseSchema.parse(data);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("campo 'images.jpg.image_url' es string o null", async () => {
    const data = await jikanFetch("/anime?q=naruto&limit=5");
    const result = JikanSearchResponseSchema.parse(data);
    for (const anime of result.data.slice(0, 3)) {
      const url = anime.images.jpg.image_url;
      expect(url === null || typeof url === "string").toBe(true);
    }
  });
});

describe("Jikan contract — /anime/{id}", () => {
  const ANIME_ID = 20; // Naruto — id estable en MAL

  it("detalle de anime tiene shape correcto", async () => {
    const data = await jikanFetch(`/anime/${ANIME_ID}`);
    const result = JikanAnimeDetailSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("genres es un array de objetos con mal_id y name", async () => {
    const data = await jikanFetch(`/anime/${ANIME_ID}`);
    const result = JikanAnimeDetailSchema.parse(data);
    expect(Array.isArray(result.data.genres)).toBe(true);
  });
});

describe("Jikan contract — /anime/{id}/videos", () => {
  const ANIME_ID = 20;

  it("videos tienen shape de JikanVideosSchema", async () => {
    const data = await jikanFetch(`/anime/${ANIME_ID}/videos`);
    const result = JikanVideosSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });
});
