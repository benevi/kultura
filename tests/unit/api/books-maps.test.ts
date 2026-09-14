// ============================================================
// KULTURA — Google Books filter translation tests (E-BOOKS-GOOGLE)
// género→subject:"…", editorial→inpublisher:"…" (nativo, multi=OR),
// formato→params.filter, sort→params.orderBy, idioma→override de langRestrict,
// año→post-filtro (matcher), guard de desconocidos, query base sin filtros.
//
// Sustituye a los tests de la etapa Open Library (E84b): esos verificaban
// `publisher:`/`language:<iso3>`/`first_publish_year:` y el param `sort`, que
// ya no existen en el contrato de Google Books.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  BOOKS_GENRE,
  BOOKS_PUBLISHER,
  GOOGLE_BOOKS_BASE_QUERY,
  googleBooksOrderBy,
  booksLangRestrictOverride,
  bookYearMatcher,
  hasBookFilters,
  buildGoogleBooksQuery,
  filterBooksByLanguage,
  sortBooksByLanguage,
} from "@/lib/api/books-maps";

// ── Tablas ───────────────────────────────────────────────────────────────────

describe("BOOKS_GENRE / BOOKS_PUBLISHER", () => {
  it("mapea slugs canónicos a términos subject BISAC inglés", () => {
    expect(BOOKS_GENRE["ciencia-ficcion"]).toBe("Science Fiction");
    expect(BOOKS_GENRE.fantasia).toBe("Fantasy");
    expect(BOOKS_GENRE.historia).toBe("History");
    expect(BOOKS_GENRE.terror).toBe("Horror");
  });

  it("mapea slugs de editorial a su nombre", () => {
    expect(BOOKS_PUBLISHER.planeta).toBe("Planeta");
    expect(BOOKS_PUBLISHER.salamandra).toBe("Salamandra");
  });
});

// ── googleBooksOrderBy ───────────────────────────────────────────────────────

describe("googleBooksOrderBy", () => {
  it("recientes / newest / release_desc / recent → newest", () => {
    expect(googleBooksOrderBy("recientes")).toBe("newest");
    expect(googleBooksOrderBy("newest")).toBe("newest");
    expect(googleBooksOrderBy("release_desc")).toBe("newest");
    expect(googleBooksOrderBy("recent")).toBe("newest");
  });

  it("sorts sin equivalente nativo → undefined (relevancia, sin inventar orden)", () => {
    // Google Books solo admite relevance|newest: rating y title NO existen.
    expect(googleBooksOrderBy("rating")).toBeUndefined();
    expect(googleBooksOrderBy("title")).toBeUndefined();
    expect(googleBooksOrderBy("popularity")).toBeUndefined();
    expect(googleBooksOrderBy("relevance")).toBeUndefined();
    expect(googleBooksOrderBy(null)).toBeUndefined();
    expect(googleBooksOrderBy(undefined)).toBeUndefined();
  });
});

// ── booksLangRestrictOverride ────────────────────────────────────────────────

describe("booksLangRestrictOverride", () => {
  it("acepta ISO-639-1 de 2 letras y normaliza a minúsculas", () => {
    expect(booksLangRestrictOverride("ja")).toBe("ja");
    expect(booksLangRestrictOverride("EN")).toBe("en");
    expect(booksLangRestrictOverride(" fr ")).toBe("fr");
  });

  it("descarta lo que no sea un código de 2 letras", () => {
    expect(booksLangRestrictOverride("spa")).toBeUndefined();
    expect(booksLangRestrictOverride("")).toBeUndefined();
    expect(booksLangRestrictOverride(null)).toBeUndefined();
    expect(booksLangRestrictOverride("es-ES")).toBeUndefined();
  });
});

// ── bookYearMatcher (post-filtro) ────────────────────────────────────────────

describe("bookYearMatcher", () => {
  it("YYYY → predicado de igualdad sobre el año del item", () => {
    const m = bookYearMatcher("2003");
    expect(m).toBeDefined();
    expect(m!(2003)).toBe(true);
    expect(m!(2004)).toBe(false);
    expect(m!(undefined)).toBe(false);
  });

  it("buckets no soportados (décadas / classic) → undefined, no filtra", () => {
    // Google Books no tiene operador de fecha: solo se soporta el año exacto.
    expect(bookYearMatcher("2010s")).toBeUndefined();
    expect(bookYearMatcher("classic")).toBeUndefined();
    expect(bookYearMatcher(null)).toBeUndefined();
    expect(bookYearMatcher("")).toBeUndefined();
  });
});

// ── hasBookFilters ───────────────────────────────────────────────────────────

describe("hasBookFilters", () => {
  it("true con género, editorial, formato, idioma-override o sort nativo", () => {
    expect(hasBookFilters({ genre: ["fantasia"] })).toBe(true);
    expect(hasBookFilters({ editorial: ["planeta"] })).toBe(true);
    expect(hasBookFilters({ formato: "free" })).toBe(true);
    expect(hasBookFilters({ idioma: "ja" })).toBe(true);
    expect(hasBookFilters({ sort: "recientes" })).toBe(true);
  });

  it("false sin filtros o con valores que no producen query", () => {
    expect(hasBookFilters({})).toBe(false);
    expect(hasBookFilters({ genre: [] })).toBe(false);
    expect(hasBookFilters({ sort: "relevance" })).toBe(false);
    expect(hasBookFilters({ formato: "physical" })).toBe(false);
  });

  it("el AÑO no cuenta: es post-filtro, necesita el catálogo base", () => {
    expect(hasBookFilters({ year: "2003" })).toBe(false);
  });
});

// ── buildGoogleBooksQuery ────────────────────────────────────────────────────

describe("buildGoogleBooksQuery", () => {
  it("sin filtros → query base (Google Books exige q no vacío)", () => {
    const { q, params } = buildGoogleBooksQuery({});
    expect(q).toBe(GOOGLE_BOOKS_BASE_QUERY);
    expect(params).toEqual({});
  });

  it("género → subject:\"…\" con comillas (si no, el espacio parte el término)", () => {
    const { q } = buildGoogleBooksQuery({ genre: ["ciencia-ficcion"] });
    expect(q).toBe('subject:"Science Fiction"');
  });

  it("multi-género → un subject: por slug", () => {
    const { q } = buildGoogleBooksQuery({ genre: ["fantasia", "terror"] });
    expect(q).toBe('subject:"Fantasy" subject:"Horror"');
  });

  it("editorial única → inpublisher: sin paréntesis", () => {
    const { q } = buildGoogleBooksQuery({ editorial: ["planeta"] });
    expect(q).toBe('inpublisher:"Planeta"');
  });

  it("editorial múltiple → OR entre paréntesis", () => {
    const { q } = buildGoogleBooksQuery({ editorial: ["planeta", "norma"] });
    expect(q).toBe('(inpublisher:"Planeta" OR inpublisher:"Norma")');
  });

  it("combina género + editorial en la misma q", () => {
    const { q } = buildGoogleBooksQuery({
      genre: ["fantasia"],
      editorial: ["salamandra"],
    });
    expect(q).toBe('subject:"Fantasy" inpublisher:"Salamandra"');
  });

  it("slugs desconocidos se descartan (y caen a la query base si no queda nada)", () => {
    const { q } = buildGoogleBooksQuery({
      genre: ["no-existe"],
      editorial: ["tampoco"],
    });
    expect(q).toBe(GOOGLE_BOOKS_BASE_QUERY);
  });

  it("formato free/ebook → params.filter; physical → sin filter", () => {
    expect(buildGoogleBooksQuery({ formato: "free" }).params.filter).toBe(
      "free-ebooks"
    );
    expect(buildGoogleBooksQuery({ formato: "ebook" }).params.filter).toBe(
      "ebooks"
    );
    expect(
      buildGoogleBooksQuery({ formato: "physical" }).params.filter
    ).toBeUndefined();
  });

  it("sort nativo → params.orderBy", () => {
    expect(buildGoogleBooksQuery({ sort: "recientes" }).params.orderBy).toBe(
      "newest"
    );
    expect(
      buildGoogleBooksQuery({ sort: "rating" }).params.orderBy
    ).toBeUndefined();
  });

  it("idioma → override de langRestrict en params", () => {
    expect(buildGoogleBooksQuery({ idioma: "ja" }).params.langRestrict).toBe(
      "ja"
    );
    expect(
      buildGoogleBooksQuery({ idioma: "spa" }).params.langRestrict
    ).toBeUndefined();
  });

  it("el año NO entra en q ni en params (es post-filtro)", () => {
    const { q, params } = buildGoogleBooksQuery({ year: "2003" });
    expect(q).toBe(GOOGLE_BOOKS_BASE_QUERY);
    expect(params).toEqual({});
  });
});

// ============================================================
// E-BOOKS-LANG — preferir la edición del idioma activo
//
// `langRestrict` es una pista para Google, no una garantía: se cuelan
// ediciones en otro idioma y el usuario ve el título en un idioma que no es el
// suyo. Lo que se protege aquí es la regla completa, degradación incluida:
// preferir español NO puede dejar la rejilla vacía.
// ============================================================
// E-BOOKS-LANG — idioma real de la edición
//
// `langRestrict` es una pista para Google, no una garantía: se cuelan
// ediciones en otro idioma y el usuario ve el título en un idioma que no es el
// suyo. Son dos reglas distintas a propósito:
//   - Catálogo (Descubrir) → recorta: allí manda el idioma de la app.
//   - Búsqueda por texto   → solo ordena: quien busca un título concreto tiene
//     que encontrarlo aunque solo exista en su idioma original.
// ============================================================

describe('filterBooksByLanguage / sortBooksByLanguage (E-BOOKS-LANG)', () => {
  const book = (id: string, language?: string) => ({
    id: `book_${id}`,
    metadata: language === undefined ? {} : { language },
  })

  it('el catálogo descarta lo que no sea del idioma pedido', () => {
    const items = [book('es1', 'es'), book('en1', 'en'), book('fr1', 'fr')]
    const out = filterBooksByLanguage(items, 'es')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('book_es1')
  })

  it('acepta variantes regionales a ambos lados (es-419 vs es-ES)', () => {
    const items = [book('la1', 'es-419'), book('en1', 'en')]
    expect(filterBooksByLanguage(items, 'es-ES')).toHaveLength(1)
  })

  it('un volumen sin idioma declarado nunca cuenta como del idioma pedido', () => {
    expect(filterBooksByLanguage([book('sin')], 'es')).toHaveLength(0)
  })

  it('idioma vacío → no hay preferencia que aplicar, pasa todo', () => {
    const items = [book('en1', 'en'), book('es1', 'es')]
    expect(filterBooksByLanguage(items, '')).toEqual(items)
  })

  it('la búsqueda ordena pero NO descarta', () => {
    const items = [book('en1', 'en'), book('es1', 'es'), book('en2', 'en')]
    const out = sortBooksByLanguage(items, 'es')
    expect(out).toHaveLength(3)
    expect(out[0].id).toBe('book_es1')
  })

  it('la búsqueda sin ninguna edición del idioma deja la lista intacta', () => {
    const items = [book('en1', 'en'), book('ja1', 'ja')]
    expect(sortBooksByLanguage(items, 'es')).toEqual(items)
  })
})
