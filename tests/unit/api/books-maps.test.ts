// ============================================================
// KULTURA — Google Books filter translation tests (E59 F3c)
// género→subject: (q), sort→orderBy, formato→filter, idioma→langRestrict,
// year ignorado (oculto book), physical sin filter, guard de desconocidos.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  BOOKS_GENRE,
  BOOKS_BASE_QUERY,
  booksOrderBy,
  booksFilter,
  hasBookFilters,
  buildBooksQuery,
  filterBooksByEditorial,
} from "@/lib/api/books-maps";
import type { MediaItem } from "@/types/media";

function book(id: string, publisher: unknown): MediaItem {
  return {
    id: `book_${id}`,
    externalId: id,
    type: "book",
    title: id,
    metadata: { publisher },
  };
}

// ── Tablas ───────────────────────────────────────────────────────────────────

describe("BOOKS_GENRE", () => {
  it("mapea slugs canónicos a términos subject BISAC inglés", () => {
    expect(BOOKS_GENRE["ciencia-ficcion"]).toBe("Science Fiction");
    expect(BOOKS_GENRE.fantasia).toBe("Fantasy");
    expect(BOOKS_GENRE.historia).toBe("History");
    expect(BOOKS_GENRE.terror).toBe("Horror");
  });
});

// ── booksOrderBy ───────────────────────────────────────────────────────────────

describe("booksOrderBy", () => {
  it("recientes / newest / release_desc → newest", () => {
    expect(booksOrderBy("recientes")).toBe("newest");
    expect(booksOrderBy("newest")).toBe("newest");
    expect(booksOrderBy("release_desc")).toBe("newest");
  });

  it("resto / null → relevance", () => {
    expect(booksOrderBy("popularity")).toBe("relevance");
    expect(booksOrderBy("rating")).toBe("relevance");
    expect(booksOrderBy("title_az")).toBe("relevance");
    expect(booksOrderBy(null)).toBe("relevance");
    expect(booksOrderBy(undefined)).toBe("relevance");
  });
});

// ── booksFilter ────────────────────────────────────────────────────────────────

describe("booksFilter", () => {
  it("free → free-ebooks, ebook → ebooks", () => {
    expect(booksFilter("free")).toBe("free-ebooks");
    expect(booksFilter("ebook")).toBe("ebooks");
  });

  it("physical / vacío / desconocido → undefined", () => {
    expect(booksFilter("physical")).toBeUndefined();
    expect(booksFilter(null)).toBeUndefined();
    expect(booksFilter("zzz")).toBeUndefined();
  });
});

// ── hasBookFilters ─────────────────────────────────────────────────────────────

describe("hasBookFilters", () => {
  it("sin filtros → false", () => {
    expect(hasBookFilters()).toBe(false);
    expect(hasBookFilters({})).toBe(false);
  });

  it("género / formato / idioma → true", () => {
    expect(hasBookFilters({ genre: ["fantasia"] })).toBe(true);
    expect(hasBookFilters({ formato: "free" })).toBe(true);
    expect(hasBookFilters({ idioma: "en" })).toBe(true);
  });

  it("sort que cambia orderBy (newest) → true; relevance-only → false", () => {
    expect(hasBookFilters({ sort: "release_desc" })).toBe(true);
    expect(hasBookFilters({ sort: "popularity" })).toBe(false);
    expect(hasBookFilters({ sort: "title_az" })).toBe(false);
  });

  it("género vacío no cuenta", () => {
    expect(hasBookFilters({ genre: [] })).toBe(false);
  });
});

// ── buildBooksQuery ────────────────────────────────────────────────────────────

describe("buildBooksQuery", () => {
  it("sin filtros → q base + orderBy relevance, sin filter/langRestrict", () => {
    const { q, params } = buildBooksQuery();
    expect(q).toBe(BOOKS_BASE_QUERY);
    expect(params).toEqual({ orderBy: "relevance" });
  });

  it("género → q con subject:", () => {
    const { q } = buildBooksQuery({ genre: ["fantasia"] });
    expect(q).toBe('subject:"Fantasy"');
  });

  it("multi-género → varios subject: unidos", () => {
    const { q } = buildBooksQuery({
      genre: ["fantasia", "ciencia-ficcion"],
    });
    expect(q).toBe('subject:"Fantasy" subject:"Science Fiction"');
  });

  it("género desconocido se descarta; todos desconocidos → q base", () => {
    expect(buildBooksQuery({ genre: ["fantasia", "nope"] }).q).toBe(
      'subject:"Fantasy"'
    );
    expect(buildBooksQuery({ genre: ["nope"] }).q).toBe(BOOKS_BASE_QUERY);
  });

  it("formato → filter; physical no añade filter", () => {
    expect(buildBooksQuery({ formato: "free" }).params.filter).toBe(
      "free-ebooks"
    );
    expect(buildBooksQuery({ formato: "ebook" }).params.filter).toBe("ebooks");
    expect(buildBooksQuery({ formato: "physical" }).params.filter).toBeUndefined();
  });

  it("idioma ISO → langRestrict; inválido se descarta", () => {
    expect(buildBooksQuery({ idioma: "EN" }).params.langRestrict).toBe("en");
    expect(buildBooksQuery({ idioma: "english" }).params.langRestrict).toBeUndefined();
  });

  it("sort → orderBy", () => {
    expect(buildBooksQuery({ sort: "release_desc" }).params.orderBy).toBe(
      "newest"
    );
    expect(buildBooksQuery({ sort: "popularity" }).params.orderBy).toBe(
      "relevance"
    );
  });

  it("year NO produce ningún param (oculto para book)", () => {
    const { q, params } = buildBooksQuery({
      year: "2020s",
    } as Parameters<typeof buildBooksQuery>[0]);
    expect(q).toBe(BOOKS_BASE_QUERY);
    expect(params).toEqual({ orderBy: "relevance" });
  });

  it("combinación completa: género + formato + idioma + sort", () => {
    const { q, params } = buildBooksQuery({
      genre: ["historia"],
      formato: "free",
      idioma: "es",
      sort: "release_desc",
    });
    expect(q).toBe('subject:"History"');
    expect(params).toEqual({
      orderBy: "newest",
      filter: "free-ebooks",
      langRestrict: "es",
    });
  });

  it("editorial NO entra en la query nativa (es post-filtro R4c-2)", () => {
    const { q, params } = buildBooksQuery({ editorial: ["planeta"] });
    expect(q).toBe(BOOKS_BASE_QUERY);
    expect(params).toEqual({ orderBy: "relevance" });
  });
});

// ── filterBooksByEditorial (POST-filtro R4c-2, substring case-insensitive) ───

describe("filterBooksByEditorial", () => {
  const items = [
    book("a", "Editorial Planeta S.A."),
    book("b", "Norma Editorial"),
    book("c", "Penguin Random House"),
    book("d", undefined), // sin publisher → descartado cuando hay editorial
  ];

  it("filtra por substring case-insensitive del publisher", () => {
    expect(
      filterBooksByEditorial(items, ["planeta"]).map((i) => i.externalId)
    ).toEqual(["a"]);
  });

  it("multi-select → OR (planeta + norma)", () => {
    expect(
      filterBooksByEditorial(items, ["planeta", "norma"])
        .map((i) => i.externalId)
        .sort()
    ).toEqual(["a", "b"]);
  });

  it("editorial de cómic (image) no mapea a book → no filtra por ella", () => {
    // "image" no está en BOOKS_PUBLISHER → substrings vacío → no filtra.
    expect(filterBooksByEditorial(items, ["image"])).toHaveLength(4);
  });

  it("vacío → no filtra (intactos)", () => {
    expect(filterBooksByEditorial(items, [])).toHaveLength(4);
    expect(filterBooksByEditorial(items, undefined)).toHaveLength(4);
  });

  it("hasBookFilters NO se dispara por editorial (no gatea el fetch)", () => {
    expect(hasBookFilters({ editorial: ["planeta"] })).toBe(false);
  });
});
