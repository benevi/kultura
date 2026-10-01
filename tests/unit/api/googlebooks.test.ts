// ============================================================
// KULTURA — Google Books client (E-BOOKS-GOOGLE)
// Cubre: params enviados (langRestrict del locale, startIndex/maxResults,
// printType), key opcional, helpers de portada/paginación/id legacy, y el
// detalle (404 → null, sin langRestrict).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchGoogleBooks,
  getGoogleBookDetail,
  googleBooksCover,
  googleBooksTotalPages,
  googleBooksStartIndex,
  isOpenLibraryWorkId,
  GOOGLE_BOOKS_PAGE_SIZE,
} from "@/lib/api/googlebooks";

function mockFetch(
  body: unknown = { totalItems: 0 },
  init: { ok?: boolean; status?: number } = {}
) {
  const spy = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

function lastUrl(spy: ReturnType<typeof mockFetch>): URL {
  const calls = spy.mock.calls;
  return new URL(calls[calls.length - 1][0] as string);
}

const ORIGINAL_KEY = process.env.GOOGLE_BOOKS_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_BOOKS_KEY;
  else process.env.GOOGLE_BOOKS_KEY = ORIGINAL_KEY;
  vi.resetModules();
});

// ── searchGoogleBooks ─────────────────────────────────────────────────────────

describe("searchGoogleBooks — params", () => {
  let spy: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    spy = mockFetch({ totalItems: 100, items: [] });
  });

  it("langRestrict deriva del locale activo", async () => {
    await searchGoogleBooks("subject:fiction", 1, {}, "en");
    expect(lastUrl(spy).searchParams.get("langRestrict")).toBe("en");
    await searchGoogleBooks("subject:fiction", 1, {}, "es");
    expect(lastUrl(spy).searchParams.get("langRestrict")).toBe("es");
  });

  it("sin locale cae a es (default de la app)", async () => {
    await searchGoogleBooks("subject:fiction");
    expect(lastUrl(spy).searchParams.get("langRestrict")).toBe("es");
  });

  it("pagina con startIndex (0-indexed) y maxResults", async () => {
    await searchGoogleBooks("q", 3);
    const url = lastUrl(spy);
    expect(url.searchParams.get("startIndex")).toBe("40");
    expect(url.searchParams.get("maxResults")).toBe(
      String(GOOGLE_BOOKS_PAGE_SIZE)
    );
  });

  it("envía q y printType=books", async () => {
    await searchGoogleBooks('subject:"Fantasy"');
    const url = lastUrl(spy);
    expect(url.searchParams.get("q")).toBe('subject:"Fantasy"');
    expect(url.searchParams.get("printType")).toBe("books");
  });

  it("los params extra (orderBy/filter) se pasan y pueden pisar langRestrict", async () => {
    await searchGoogleBooks(
      "q",
      1,
      { orderBy: "newest", filter: "free-ebooks", langRestrict: "ja" },
      "es"
    );
    const url = lastUrl(spy);
    expect(url.searchParams.get("orderBy")).toBe("newest");
    expect(url.searchParams.get("filter")).toBe("free-ebooks");
    // override explícito del trigger `idioma` > locale
    expect(url.searchParams.get("langRestrict")).toBe("ja");
  });

  it("lanza con status no-ok (la capa de Descubrir lo convierte en banner)", async () => {
    vi.unstubAllGlobals();
    mockFetch({ error: {} }, { ok: false, status: 429 });
    await expect(searchGoogleBooks("q")).rejects.toThrow(/429/);
  });
});

describe("searchGoogleBooks — key opcional", () => {
  it("sin GOOGLE_BOOKS_KEY no envía `key` y la petición se intenta igual", async () => {
    delete process.env.GOOGLE_BOOKS_KEY;
    vi.resetModules();
    const spy = mockFetch({ totalItems: 0 });
    const mod = await import("@/lib/api/googlebooks");
    await mod.searchGoogleBooks("q");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(lastUrl(spy).searchParams.has("key")).toBe(false);
  });

  it("con GOOGLE_BOOKS_KEY la envía como `key`", async () => {
    process.env.GOOGLE_BOOKS_KEY = "test-gb-key";
    vi.resetModules();
    const spy = mockFetch({ totalItems: 0 });
    const mod = await import("@/lib/api/googlebooks");
    await mod.searchGoogleBooks("q");
    expect(lastUrl(spy).searchParams.get("key")).toBe("test-gb-key");
  });
});

// ── getGoogleBookDetail ───────────────────────────────────────────────────────

describe("getGoogleBookDetail", () => {
  it("pide /volumes/{id} SIN langRestrict (una ficha concreta no se filtra)", async () => {
    const spy = mockFetch({ id: "abc", volumeInfo: { title: "T" } });
    await getGoogleBookDetail("abc");
    const url = lastUrl(spy);
    expect(url.pathname).toBe("/books/v1/volumes/abc");
    expect(url.searchParams.has("langRestrict")).toBe(false);
  });

  it("404 → null (el caller hace notFound, no 500)", async () => {
    mockFetch({}, { ok: false, status: 404 });
    await expect(getGoogleBookDetail("nope")).resolves.toBeNull();
  });

  it("otros errores siguen lanzando", async () => {
    mockFetch({}, { ok: false, status: 500 });
    await expect(getGoogleBookDetail("x")).rejects.toThrow(/500/);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

describe("googleBooksCover", () => {
  it("fuerza https (Google sirve miniaturas en http → mixed content)", () => {
    expect(
      googleBooksCover({ thumbnail: "http://books.google.com/books/content?id=x&zoom=5" })
    ).toBe("https://books.google.com/books/content?id=x&zoom=1");
  });

  it("prefiere la variante más grande disponible", () => {
    expect(
      googleBooksCover({
        smallThumbnail: "https://x/small",
        thumbnail: "https://x/thumb",
        large: "https://x/large",
      })
    ).toBe("https://x/large");
  });

  it("sube el zoom solo en URLs de books/content", () => {
    expect(googleBooksCover({ thumbnail: "https://other/img.jpg?zoom=5" })).toBe(
      "https://other/img.jpg?zoom=5"
    );
  });

  it("sin imageLinks → undefined", () => {
    expect(googleBooksCover(undefined)).toBeUndefined();
    expect(googleBooksCover({})).toBeUndefined();
  });
});

describe("googleBooksTotalPages / googleBooksStartIndex", () => {
  it("traduce totalItems a páginas de 20", () => {
    expect(googleBooksTotalPages(100)).toBe(5);
    expect(googleBooksTotalPages(101)).toBe(6);
  });

  it("total 0 / ausente → 1 página (no 0: la UI necesita una página válida)", () => {
    expect(googleBooksTotalPages(0)).toBe(1);
    expect(googleBooksTotalPages(undefined)).toBe(1);
    expect(googleBooksTotalPages(-5)).toBe(1);
  });

  it("page → startIndex 0-indexed, nunca negativo", () => {
    expect(googleBooksStartIndex(1)).toBe(0);
    expect(googleBooksStartIndex(2)).toBe(20);
    expect(googleBooksStartIndex(0)).toBe(0);
  });
});

describe("isOpenLibraryWorkId", () => {
  it("reconoce los ids de obra/edición de Open Library", () => {
    expect(isOpenLibraryWorkId("OL7353617W")).toBe(true);
    expect(isOpenLibraryWorkId("/works/OL7353617W")).toBe(true);
    expect(isOpenLibraryWorkId("OL123M")).toBe(true);
  });

  it("no confunde un id de volumen de Google Books", () => {
    expect(isOpenLibraryWorkId("wrOQLV6xB-wC")).toBe(false);
    expect(isOpenLibraryWorkId("OLmalformado")).toBe(false);
    expect(isOpenLibraryWorkId("")).toBe(false);
  });
});

// ============================================================
// GoogleBooksError — el status tiene que viajar, no solo el mensaje
//
// Un 429 (cuota agotada) es transitorio y la UI tiene un mensaje propio para
// él; un 400 o un 503 no. Con el status solo dentro del texto del error, quien
// lo capturaba no podía distinguirlos y todo acababa en "no se pudo cargar".
// ============================================================

describe('GoogleBooksError', () => {
  const failWith = (status: number) => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status,
    } as Response)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('un fallo HTTP expone el status como campo', async () => {
    failWith(429)
    await expect(searchGoogleBooks('test')).rejects.toMatchObject({
      name: 'GoogleBooksError',
      status: 429,
    })
  })

  it('el 404 del detalle sigue devolviendo null, no lanza', async () => {
    failWith(404)
    await expect(getGoogleBookDetail('noexiste')).resolves.toBeNull()
  })

  it('un fallo que no es 404 sí se propaga desde el detalle', async () => {
    failWith(500)
    await expect(getGoogleBookDetail('x')).rejects.toMatchObject({ status: 500 })
  })
})
