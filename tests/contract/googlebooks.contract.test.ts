/**
 * Test de contrato — Google Books API
 * Requiere NEXT_PUBLIC_GOOGLE_BOOKS_KEY en .env.local
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY ?? "";
const BASE = "https://www.googleapis.com/books/v1";

// ── Schemas ───────────────────────────────────────────────────────────────────

const ImageLinksSchema = z
  .object({
    thumbnail: z.string().optional(),
    smallThumbnail: z.string().optional(),
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional(),
  })
  .optional();

const VolumeInfoSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()).optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  imageLinks: ImageLinksSchema,
  averageRating: z.number().optional(),
  ratingsCount: z.number().optional(),
  language: z.string().optional(),
  pageCount: z.number().optional(),
});

const VolumeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  volumeInfo: VolumeInfoSchema,
});

const SearchResponseSchema = z.object({
  kind: z.string(),
  totalItems: z.number(),
  items: z.array(VolumeSchema).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function booksFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GoogleBooks ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GoogleBooks contract — /volumes?q=", () => {
  it("shape de búsqueda coincide con SearchResponseSchema", async () => {
    const data = await booksFetch("/volumes?q=harry+potter&maxResults=5");
    const result = SearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("devuelve items para 'harry potter'", async () => {
    const data = await booksFetch("/volumes?q=harry+potter&maxResults=5");
    const result = SearchResponseSchema.parse(data);
    expect(result.totalItems).toBeGreaterThan(0);
    expect(result.items).toBeDefined();
    expect(result.items!.length).toBeGreaterThan(0);
  });

  it("volumeInfo.title siempre está presente", async () => {
    const data = await booksFetch("/volumes?q=harry+potter&maxResults=5");
    const result = SearchResponseSchema.parse(data);
    for (const vol of (result.items ?? []).slice(0, 5)) {
      expect(typeof vol.volumeInfo.title).toBe("string");
    }
  });

  it("imageLinks.thumbnail es string o undefined (nunca null)", async () => {
    const data = await booksFetch("/volumes?q=harry+potter&maxResults=5");
    const result = SearchResponseSchema.parse(data);
    for (const vol of (result.items ?? []).slice(0, 5)) {
      const thumb = vol.volumeInfo.imageLinks?.thumbnail;
      expect(thumb === undefined || typeof thumb === "string").toBe(true);
    }
  });
});

describe("GoogleBooks contract — /volumes/{id} (detalle)", () => {
  // Harry Potter y la Piedra Filosofal — ID estable
  const VOLUME_ID = "wrOQLV6xB-wC";

  it("shape de detalle coincide con VolumeSchema", async () => {
    const data = await booksFetch(`/volumes/${VOLUME_ID}`);
    const result = VolumeSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("volumeInfo.authors es un array de strings", async () => {
    const data = await booksFetch(`/volumes/${VOLUME_ID}`);
    const result = VolumeSchema.parse(data);
    expect(Array.isArray(result.volumeInfo.authors)).toBe(true);
  });
});
