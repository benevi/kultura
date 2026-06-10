// ============================================================
// KULTURA — Open Library filter translation tests (E84b)
// género→subject:, editorial→publisher: (nativo, multi=OR), idioma→language:<iso3>,
// año→first_publish_year:[Y TO Y], formato→ebook_access:, sort→params.sort,
// guard de desconocidos, query base sin filtros.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  BOOKS_GENRE,
  OPEN_LIBRARY_BASE_QUERY,
  openLibrarySort,
  hasBookFilters,
  buildOpenLibraryQuery,
} from "@/lib/api/books-maps";

// ── Tablas ───────────────────────────────────────────────────────────────────

describe("BOOKS_GENRE", () => {
  it("mapea slugs canónicos a términos subject BISAC inglés", () => {
    expect(BOOKS_GENRE["ciencia-ficcion"]).toBe("Science Fiction");
    expect(BOOKS_GENRE.fantasia).toBe("Fantasy");
    expect(BOOKS_GENRE.historia).toBe("History");
    expect(BOOKS_GENRE.terror).toBe("Horror");
  });
});

// ── openLibrarySort ────────────────────────────────────────────────────────────

describe("openLibrarySort", () => {
  it("recientes / newest / release_desc / recent → new", () => {
    expect(openLibrarySort("recientes")).toBe("new");
    expect(openLibrarySort("newest")).toBe("new");
    expect(openLibrarySort("release_desc")).toBe("new");
    expect(openLibrarySort("recent")).toBe("new");
  });

  it("rating → rating, title → title", () => {
    expect(openLibrarySort("rating")).toBe("rating");
    expect(openLibrarySort("title")).toBe("title");
  });

  it("relevance / popularity / null / desconocido → undefined", () => {
    expect(openLibrarySort("relevance")).toBeUndefined();
    expect(openLibrarySort("popularity")).toBeUndefined();
    expect(openLibrarySort("zzz")).toBeUndefined();
    expect(openLibrarySort(null)).toBeUndefined();
    expect(openLibrarySort(undefined)).toBeUndefined();
  });
});

// ── hasBookFilters ─────────────────────────────────────────────────────────────

describe("hasBookFilters", () => {
  it("sin filtros → false", () => {
    expect(hasBookFilters()).toBe(false);
    expect(hasBookFilters({})).toBe(false);
  });

  it("género / formato / idioma / año → true", () => {
    expect(hasBookFilters({ genre: ["fantasia"] })).toBe(true);
    expect(hasBookFilters({ formato: "free" })).toBe(true);
    expect(hasBookFilters({ idioma: "en" })).toBe(true);
    expect(hasBookFilters({ year: "2020" })).toBe(true);
  });

  it("editorial AHORA gatea (nativo E84b) → true", () => {
    expect(hasBookFilters({ editorial: ["planeta"] })).toBe(true);
  });

  it("sort que produce param (new/rating/title) → true; relevance-only → false", () => {
    expect(hasBookFilters({ sort: "release_desc" })).toBe(true);
    expect(hasBookFilters({ sort: "rating" })).toBe(true);
    expect(hasBookFilters({ sort: "popularity" })).toBe(false);
    expect(hasBookFilters({ sort: "relevance" })).toBe(false);
  });

  it("colecciones vacías no cuentan", () => {
    expect(hasBookFilters({ genre: [] })).toBe(false);
    expect(hasBookFilters({ editorial: [] })).toBe(false);
  });
});

// ── buildOpenLibraryQuery ───────────────────────────────────────────────────────

describe("buildOpenLibraryQuery", () => {
  it("sin filtros → q base, params vacío", () => {
    const { q, params } = buildOpenLibraryQuery();
    expect(q).toBe(OPEN_LIBRARY_BASE_QUERY);
    expect(params).toEqual({});
  });

  it("género → subject:", () => {
    expect(buildOpenLibraryQuery({ genre: ["fantasia"] }).q).toBe(
      "subject:Fantasy"
    );
  });

  it("multi-género → varios subject: unidos por espacio", () => {
    expect(
      buildOpenLibraryQuery({ genre: ["fantasia", "ciencia-ficcion"] }).q
    ).toBe("subject:Fantasy subject:Science Fiction");
  });

  it("género desconocido se descarta; todos desconocidos → q base", () => {
    expect(buildOpenLibraryQuery({ genre: ["fantasia", "nope"] }).q).toBe(
      "subject:Fantasy"
    );
    expect(buildOpenLibraryQuery({ genre: ["nope"] }).q).toBe(
      OPEN_LIBRARY_BASE_QUERY
    );
  });

  it("editorial → publisher: (nativo, single sin paréntesis)", () => {
    expect(buildOpenLibraryQuery({ editorial: ["planeta"] }).q).toBe(
      "publisher:Planeta"
    );
  });

  it("multi-select editorial → publisher:a OR publisher:b entre paréntesis", () => {
    expect(
      buildOpenLibraryQuery({ editorial: ["planeta", "norma"] }).q
    ).toBe("(publisher:Planeta OR publisher:Norma)");
  });

  it("editorial desconocida (cómic image) se descarta", () => {
    expect(buildOpenLibraryQuery({ editorial: ["image"] }).q).toBe(
      OPEN_LIBRARY_BASE_QUERY
    );
  });

  it("idioma 2→3 letras (ISO-639-3); no mapeable se descarta", () => {
    expect(buildOpenLibraryQuery({ idioma: "es" }).q).toBe("language:spa");
    expect(buildOpenLibraryQuery({ idioma: "EN" }).q).toBe("language:eng");
    expect(buildOpenLibraryQuery({ idioma: "ja" }).q).toBe("language:jpn");
    expect(buildOpenLibraryQuery({ idioma: "zz" }).q).toBe(
      OPEN_LIBRARY_BASE_QUERY
    );
  });

  it("año → first_publish_year:[Y TO Y]; no numérico se descarta", () => {
    expect(buildOpenLibraryQuery({ year: "2020" }).q).toBe(
      "first_publish_year:[2020 TO 2020]"
    );
    // bucket "2020s" → toma los 4 primeros dígitos.
    expect(buildOpenLibraryQuery({ year: "2020s" }).q).toBe(
      "first_publish_year:[2020 TO 2020]"
    );
    expect(buildOpenLibraryQuery({ year: "abc" }).q).toBe(
      OPEN_LIBRARY_BASE_QUERY
    );
  });

  it("formato free → ebook_access:public", () => {
    expect(buildOpenLibraryQuery({ formato: "free" }).q).toBe(
      "ebook_access:public"
    );
  });

  it("formato ebook → (public OR borrowable)", () => {
    expect(buildOpenLibraryQuery({ formato: "ebook" }).q).toBe(
      "(ebook_access:public OR ebook_access:borrowable)"
    );
  });

  it("formato physical → sin fragmento (q base)", () => {
    expect(buildOpenLibraryQuery({ formato: "physical" }).q).toBe(
      OPEN_LIBRARY_BASE_QUERY
    );
  });

  it("sort → params.sort solo si produce uno", () => {
    expect(buildOpenLibraryQuery({ sort: "release_desc" }).params).toEqual({
      sort: "new",
    });
    expect(buildOpenLibraryQuery({ sort: "rating" }).params).toEqual({
      sort: "rating",
    });
    expect(buildOpenLibraryQuery({ sort: "popularity" }).params).toEqual({});
  });

  it("combinación completa: género + editorial + idioma + año + formato + sort", () => {
    const { q, params } = buildOpenLibraryQuery({
      genre: ["historia"],
      editorial: ["planeta", "norma"],
      idioma: "es",
      year: "2020",
      formato: "free",
      sort: "release_desc",
    });
    expect(q).toBe(
      "subject:History (publisher:Planeta OR publisher:Norma) language:spa first_publish_year:[2020 TO 2020] ebook_access:public"
    );
    expect(params).toEqual({ sort: "new" });
  });
});
