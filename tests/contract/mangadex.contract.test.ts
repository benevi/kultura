/**
 * Test de contrato — MangaDex API
 * Sin API key requerida.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const BASE = "https://api.mangadex.org";

// ── Schemas ───────────────────────────────────────────────────────────────────

// MangaDex usa un sistema de relationships/attributes
const LocalizedStringSchema = z.record(z.string(), z.string());

const MangaAttributesSchema = z.object({
  title: LocalizedStringSchema,
  altTitles: z.array(LocalizedStringSchema).optional(),
  description: LocalizedStringSchema,
  status: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  tags: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        attributes: z.object({
          name: LocalizedStringSchema,
          group: z.string(),
        }),
      })
    )
    .optional(),
});

const MangaSchema = z.object({
  id: z.string(),
  type: z.literal("manga"),
  attributes: MangaAttributesSchema,
  relationships: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      attributes: z.record(z.string(), z.unknown()).optional(),
    })
  ),
});

const MangaSearchResponseSchema = z.object({
  result: z.literal("ok"),
  response: z.string(),
  data: z.array(MangaSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const MangaDetailResponseSchema = z.object({
  result: z.literal("ok"),
  response: z.string(),
  data: MangaSchema,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mangadexFetch(path: string): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`MangaDex ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MangaDex contract — /manga?title=", () => {
  it("shape de búsqueda coincide con MangaSearchResponseSchema", async () => {
    const data = await mangadexFetch(
      "/manga?title=one+piece&limit=5&includes[]=cover_art"
    );
    const result = MangaSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("result es 'ok' en respuesta correcta", async () => {
    const data = await mangadexFetch("/manga?title=one+piece&limit=5");
    const result = MangaSearchResponseSchema.parse(data);
    expect(result.result).toBe("ok");
  });

  it("devuelve al menos 1 resultado para 'one piece'", async () => {
    const data = await mangadexFetch("/manga?title=one+piece&limit=5");
    const result = MangaSearchResponseSchema.parse(data);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("cada manga tiene 'id' y 'type' === 'manga'", async () => {
    const data = await mangadexFetch("/manga?title=one+piece&limit=5");
    const result = MangaSearchResponseSchema.parse(data);
    for (const manga of result.data) {
      expect(typeof manga.id).toBe("string");
      expect(manga.type).toBe("manga");
    }
  });

  it("attributes.title es un mapa de idioma→string", async () => {
    const data = await mangadexFetch("/manga?title=one+piece&limit=5");
    const result = MangaSearchResponseSchema.parse(data);
    for (const manga of result.data.slice(0, 3)) {
      expect(typeof manga.attributes.title).toBe("object");
      expect(Object.values(manga.attributes.title).every((v) => typeof v === "string")).toBe(true);
    }
  });
});

// E-MANGADEX-LOCALE: contrato del filtro de idioma que usa `mangadex.ts`.
// (No ejecutable en el entorno de agente de 2026-09-12: la política de egress
// bloquea api.mangadex.org. Se ejecuta donde haya salida a internet.)
describe("MangaDex contract — availableTranslatedLanguage[]", () => {
  it("acepta varios códigos de idioma (OR) y devuelve resultados", async () => {
    const data = await mangadexFetch(
      "/manga?limit=5&includes[]=cover_art&order[followedCount]=desc" +
        "&availableTranslatedLanguage[]=es&availableTranslatedLanguage[]=es-la"
    );
    const result = MangaSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
    if (result.success) expect(result.data.data.length).toBeGreaterThan(0);
  });

  it("order[followedCount]=desc es la sintaxis válida de orden (v5)", async () => {
    const data = await mangadexFetch(
      "/manga?limit=3&order[followedCount]=desc"
    );
    const result = MangaSearchResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });
});

describe("MangaDex contract — /manga/{id} (detalle)", () => {
  // One Piece — id estable en MangaDex
  const MANGA_ID = "a1c7c817-4e59-43b7-9365-09675a149a6f";

  it("shape de detalle coincide con MangaDetailResponseSchema", async () => {
    const data = await mangadexFetch(`/manga/${MANGA_ID}?includes[]=cover_art`);
    const result = MangaDetailResponseSchema.safeParse(data);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("relationships incluye cover_art cuando se pide", async () => {
    const data = await mangadexFetch(`/manga/${MANGA_ID}?includes[]=cover_art`);
    const result = MangaDetailResponseSchema.parse(data);
    const coverArt = result.data.relationships.find((r) => r.type === "cover_art");
    // Cover art debería estar presente en series populares
    expect(coverArt).toBeDefined();
  });
});
