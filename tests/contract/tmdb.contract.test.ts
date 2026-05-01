/**
 * Test de contrato — TMDB API
 * Valida que el shape real de las respuestas coincide con nuestros tipos.
 * Requiere NEXT_PUBLIC_TMDB_API_KEY en .env.local
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
const BASE = "https://api.themoviedb.org/3";

// ── Schemas Zod ──────────────────────────────────────────────────────────────

const TmdbMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  release_date: z.string(),
  overview: z.string(),
  vote_average: z.number(),
});

const TmdbSearchResponseSchema = z.object({
  page: z.number(),
  results: z.array(TmdbMovieSchema),
  total_pages: z.number(),
  total_results: z.number(),
});

const TmdbTVSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  first_air_date: z.string(),
  overview: z.string(),
  vote_average: z.number(),
});

const TmdbTVSearchResponseSchema = z.object({
  page: z.number(),
  results: z.array(TmdbTVSchema),
  total_pages: z.number(),
  total_results: z.number(),
});

const TmdbMovieDetailSchema = TmdbMovieSchema.extend({
  runtime: z.number().nullable(),
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
});

const TmdbGenreResponseSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function tmdbFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "es-ES");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TMDB contract — /search/movie", () => {
  it("shape de respuesta coincide con TmdbSearchResponseSchema", async () => {
    const data = await tmdbFetch("/search/movie?query=inception");
    const result = TmdbSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("devuelve al menos 1 resultado para 'inception'", async () => {
    const data = await tmdbFetch("/search/movie?query=inception");
    const result = TmdbSearchResponseSchema.parse(data);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("poster_path es string o null (nunca undefined)", async () => {
    const data = await tmdbFetch("/search/movie?query=inception");
    const result = TmdbSearchResponseSchema.parse(data);
    for (const movie of result.results.slice(0, 5)) {
      expect(movie.poster_path === null || typeof movie.poster_path === "string").toBe(true);
    }
  });
});

describe("TMDB contract — /search/tv", () => {
  it("shape de respuesta coincide con TmdbTVSearchResponseSchema", async () => {
    const data = await tmdbFetch("/search/tv?query=breaking+bad");
    const result = TmdbTVSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("campo 'name' (no 'title') presente en resultados TV", async () => {
    const data = await tmdbFetch("/search/tv?query=breaking+bad");
    const result = TmdbTVSearchResponseSchema.parse(data);
    expect(result.results[0]).toHaveProperty("name");
    expect(result.results[0]).not.toHaveProperty("title");
  });
});

describe("TMDB contract — /movie/{id} (detail)", () => {
  const MOVIE_ID = 550; // Fight Club — id estable

  it("shape de detalle coincide con TmdbMovieDetailSchema", async () => {
    const data = await tmdbFetch(`/movie/${MOVIE_ID}`);
    const result = TmdbMovieDetailSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("genres es un array (no vacío para Fight Club)", async () => {
    const data = await tmdbFetch(`/movie/${MOVIE_ID}`);
    const result = TmdbMovieDetailSchema.parse(data);
    expect(Array.isArray(result.genres)).toBe(true);
    expect(result.genres.length).toBeGreaterThan(0);
  });
});

describe("TMDB contract — /genre/movie/list", () => {
  it("shape de géneros coincide con TmdbGenreResponseSchema", async () => {
    const data = await tmdbFetch("/genre/movie/list");
    const result = TmdbGenreResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });
});
