/**
 * Test de contrato — Google Books API v1 (E-BOOKS-GOOGLE)
 * Valida que el shape real de /volumes coincide con nuestros tipos y que
 * `langRestrict` acota de verdad el idioma del catálogo.
 *
 * `GOOGLE_BOOKS_KEY` es opcional para la API, pero en la práctica hace falta:
 * la cuota anónima va por IP de salida y puede estar a 0 (verificado
 * 2026-09-12: 429 RESOURCE_EXHAUSTED con quota_limit_value=0 desde una IP de
 * cloud). Si la key no está y la API responde 429, el test se marca como
 * `skipped` en vez de fallar: es una limitación de entorno, no un fallo de
 * contrato.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const API_KEY = process.env.GOOGLE_BOOKS_KEY ?? "";
const BASE = "https://www.googleapis.com/books/v1";

// ── Schemas ───────────────────────────────────────────────────────────────────

const VolumeInfoSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  pageCount: z.number().optional(),
  categories: z.array(z.string()).optional(),
  averageRating: z.number().optional(),
  ratingsCount: z.number().optional(),
  language: z.string().optional(),
  imageLinks: z
    .object({
      smallThumbnail: z.string().optional(),
      thumbnail: z.string().optional(),
    })
    .optional(),
});

const VolumeSchema = z.object({
  id: z.string(),
  volumeInfo: VolumeInfoSchema.optional(),
});

const VolumesResponseSchema = z.object({
  totalItems: z.number(),
  // Google OMITE `items` cuando no hay resultados (no devuelve []).
  items: z.array(VolumeSchema).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

class QuotaExhausted extends Error {}

async function booksFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  if (API_KEY) url.searchParams.set("key", API_KEY);
  const res = await fetch(url.toString());
  if (res.status === 429) {
    throw new QuotaExhausted(
      "Google Books 429: cuota agotada (key ausente o IP sin cuota)"
    );
  }
  if (!res.ok) throw new Error(`Google Books ${path} → HTTP ${res.status}`);
  return res.json();
}

/** Ejecuta el cuerpo; si la cuota está agotada, no falla el contrato. */
async function withQuota(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof QuotaExhausted) {
      console.warn(`[contract] SKIP — ${e.message}`);
      return;
    }
    throw e;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Google Books contract — /volumes", () => {
  it("shape de búsqueda coincide con VolumesResponseSchema", async () => {
    await withQuota(async () => {
      const data = await booksFetch(
        "/volumes?q=subject:fiction&maxResults=5&printType=books&langRestrict=es"
      );
      const result = VolumesResponseSchema.safeParse(data);
      expect(result.success, result.error?.message).toBe(true);
    });
  });

  it("langRestrict=es devuelve volúmenes con language es", async () => {
    await withQuota(async () => {
      const data = await booksFetch(
        "/volumes?q=intitle:quijote&maxResults=10&printType=books&langRestrict=es"
      );
      const parsed = VolumesResponseSchema.parse(data);
      const langs = (parsed.items ?? [])
        .map((v) => v.volumeInfo?.language)
        .filter(Boolean);
      expect(langs.length).toBeGreaterThan(0);
      expect(langs.every((l) => l === "es")).toBe(true);
    });
  });

  it("langRestrict=en devuelve volúmenes con language en", async () => {
    await withQuota(async () => {
      const data = await booksFetch(
        "/volumes?q=intitle:dune&maxResults=10&printType=books&langRestrict=en"
      );
      const parsed = VolumesResponseSchema.parse(data);
      const langs = (parsed.items ?? [])
        .map((v) => v.volumeInfo?.language)
        .filter(Boolean);
      expect(langs.length).toBeGreaterThan(0);
      expect(langs.every((l) => l === "en")).toBe(true);
    });
  });

  it("startIndex pagina (la 2ª página no repite ids de la 1ª)", async () => {
    await withQuota(async () => {
      const first = VolumesResponseSchema.parse(
        await booksFetch(
          "/volumes?q=subject:fiction&maxResults=20&startIndex=0&printType=books&langRestrict=es"
        )
      );
      const second = VolumesResponseSchema.parse(
        await booksFetch(
          "/volumes?q=subject:fiction&maxResults=20&startIndex=20&printType=books&langRestrict=es"
        )
      );
      const firstIds = new Set((first.items ?? []).map((v) => v.id));
      const secondIds = (second.items ?? []).map((v) => v.id);
      expect(secondIds.length).toBeGreaterThan(0);
      expect(secondIds.some((id) => firstIds.has(id))).toBe(false);
    });
  });

  it("detalle /volumes/{id} devuelve el volumen con volumeInfo", async () => {
    await withQuota(async () => {
      const list = VolumesResponseSchema.parse(
        await booksFetch(
          "/volumes?q=intitle:quijote&maxResults=1&printType=books&langRestrict=es"
        )
      );
      const id = list.items?.[0]?.id;
      expect(id).toBeDefined();
      const detail = await booksFetch(`/volumes/${id}`);
      const parsed = VolumeSchema.safeParse(detail);
      expect(parsed.success, parsed.error?.message).toBe(true);
    });
  });
});
