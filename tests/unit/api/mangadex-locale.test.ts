// ============================================================
// KULTURA — E-MANGADEX-LOCALE
//
// Antes: `mangadex.ts` no tenía NINGÚN manejo de idioma (ni
// `availableTranslatedLanguage[]` ni locale) y `normalizeMangaDex` leía siempre
// `title["en"]` / `description["en"]`, así que un usuario en español veía el
// manga en inglés aunque existiera versión española.
//
// Estos tests cubren las dos mitades: los params que se envían y el texto que
// se elige al normalizar (incluida la degradación cuando NO hay traducción al
// idioma activo: debe caer a otro idioma, nunca quedar vacío).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchManga, getManga, getPopularManga } from "@/lib/api/mangadex";
import type { MangaDexManga } from "@/lib/api/mangadex";
import { normalizeMangaDex } from "@/lib/api/normalizer";

function mockFetchOk() {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, offset: 0 }),
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

function lastUrl(spy: ReturnType<typeof mockFetchOk>): URL {
  const calls = spy.mock.calls;
  return new URL(calls[calls.length - 1][0] as string);
}

let fetchSpy: ReturnType<typeof mockFetchOk>;

beforeEach(() => {
  fetchSpy = mockFetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("availableTranslatedLanguage[] derivado del locale", () => {
  it("locale es → pide es + es-la, con en como red de seguridad", async () => {
    await getPopularManga(0, "es");
    const langs = lastUrl(fetchSpy).searchParams.getAll(
      "availableTranslatedLanguage[]"
    );
    expect(langs).toEqual(["es", "es-la", "en"]);
  });

  it("locale en → pide solo en", async () => {
    await getPopularManga(0, "en");
    const langs = lastUrl(fetchSpy).searchParams.getAll(
      "availableTranslatedLanguage[]"
    );
    expect(langs).toEqual(["en"]);
  });

  it("searchManga también acota por idioma y conserva title/offset", async () => {
    await searchManga("one piece", 40, "en");
    const url = lastUrl(fetchSpy);
    expect(url.searchParams.get("title")).toBe("one piece");
    expect(url.searchParams.get("offset")).toBe("40");
    expect(url.searchParams.getAll("availableTranslatedLanguage[]")).toEqual([
      "en",
    ]);
  });

  it("los params array se ACUMULAN en vez de pisarse (includes[] sobrevive)", async () => {
    await getPopularManga(0, "es");
    const url = lastUrl(fetchSpy);
    expect(url.searchParams.getAll("includes[]")).toEqual(["cover_art"]);
    expect(
      url.searchParams.getAll("availableTranslatedLanguage[]").length
    ).toBe(3);
  });

  it("order usa la sintaxis de objeto de MangaDex v5 (order[followedCount]=desc)", async () => {
    await getPopularManga();
    expect(lastUrl(fetchSpy).searchParams.get("order[followedCount]")).toBe(
      "desc"
    );
  });

  it("el detalle NO filtra por idioma (un título sin traducción no debe dar 404)", async () => {
    await getManga("a1c7c817-4e59-43b7-9365-09675a149a6f");
    const url = lastUrl(fetchSpy);
    expect(url.searchParams.getAll("availableTranslatedLanguage[]")).toEqual([]);
    expect(url.searchParams.getAll("includes[]")).toEqual(["cover_art"]);
  });
});

// ── normalizeMangaDex ─────────────────────────────────────────────────────────

function fixture(overrides: Partial<MangaDexManga["attributes"]> = {}): MangaDexManga {
  return {
    id: "uuid-1",
    attributes: {
      title: { en: "Solo Leveling", es: "Solo Leveling ES", "ja-ro": "Ore dake" },
      description: { en: "EN synopsis", es: "Sinopsis ES" },
      year: 2018,
      status: "completed",
      tags: [
        {
          attributes: {
            name: { en: "Action", es: "Acción" },
            group: "genre",
          },
        },
        {
          attributes: {
            name: { en: "Long Strip", es: "Tira larga" },
            group: "format",
          },
        },
      ],
      lastChapter: "179",
      lastVolume: "14",
      ...overrides,
    },
    relationships: [],
  };
}

describe("normalizeMangaDex — texto en el idioma activo", () => {
  it("locale es → título, sinopsis y géneros en español", () => {
    const item = normalizeMangaDex(fixture(), "es");
    expect(item.title).toBe("Solo Leveling ES");
    expect(item.synopsis).toBe("Sinopsis ES");
    expect(item.genres).toEqual(["Acción"]);
  });

  it("locale en → título, sinopsis y géneros en inglés", () => {
    const item = normalizeMangaDex(fixture(), "en");
    expect(item.title).toBe("Solo Leveling");
    expect(item.synopsis).toBe("EN synopsis");
    expect(item.genres).toEqual(["Action"]);
  });

  it("solo cuenta el grupo genre (format/theme se descartan)", () => {
    const item = normalizeMangaDex(fixture(), "es");
    expect(item.genres).not.toContain("Tira larga");
  });

  it("sin traducción al idioma activo degrada a inglés, no a vacío", () => {
    const item = normalizeMangaDex(
      fixture({
        title: { en: "Only EN" },
        description: { en: "Only EN desc" },
      }),
      "es"
    );
    expect(item.title).toBe("Only EN");
    expect(item.synopsis).toBe("Only EN desc");
  });

  it("sin inglés ni idioma activo cae al idioma original (nunca 'Unknown' si hay algo)", () => {
    const item = normalizeMangaDex(
      fixture({
        title: { ja: "俺だけレベルアップな件" },
        description: {},
      }),
      "es"
    );
    expect(item.title).toBe("俺だけレベルアップな件");
    expect(item.synopsis).toBeUndefined();
  });

  it("id/externalId/type y metadata se mantienen", () => {
    const item = normalizeMangaDex(fixture(), "es");
    expect(item.id).toBe("manga_uuid-1");
    expect(item.externalId).toBe("uuid-1");
    expect(item.type).toBe("manga");
    expect(item.year).toBe(2018);
    expect(item.metadata?.lastChapter).toBe("179");
  });
});
