// ============================================================
// KULTURA — Filtros → query de Open Library (E-BOOKS-HIBRIDO)
//
// Lo que se protege aquí es justo lo que Google Books NO sabía hacer y por lo
// que la pestaña de libros daba títulos en inglés y filtros vacíos: que el
// idioma y el año viajen COMO FILTROS al proveedor, no como un recorte
// posterior sobre lo ya recibido.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildOpenLibraryQuery,
  openLibraryYearRange,
  openLibrarySort,
  openLibraryLanguage,
  openLibraryFulltext,
  OPEN_LIBRARY_BASE_QUERY,
} from "@/lib/api/openlibrary-maps";

describe("openLibraryLanguage", () => {
  it("traduce el locale de la app a ISO-639-2/B", () => {
    expect(openLibraryLanguage("es")).toBe("spa");
    expect(openLibraryLanguage("en")).toBe("eng");
  });

  it("acepta variantes regionales y cae al idioma por defecto", () => {
    expect(openLibraryLanguage("es-ES")).toBe("spa");
    expect(openLibraryLanguage("en-US")).toBe("eng");
    expect(openLibraryLanguage(undefined)).toBe("spa");
    expect(openLibraryLanguage("xx")).toBe("spa");
  });
});

describe("openLibraryYearRange", () => {
  // Con Google Books solo se atendía el año suelto: décadas y "classic" se
  // ignoraban en silencio, así que el filtro parecía no hacer nada.
  it("un año suelto es un rango de un año", () => {
    expect(openLibraryYearRange("2024")).toEqual({ from: 2024, to: 2024 });
  });

  it("una década cubre sus diez años", () => {
    expect(openLibraryYearRange("2000s")).toEqual({ from: 2000, to: 2009 });
    expect(openLibraryYearRange("1990s")).toEqual({ from: 1990, to: 1999 });
  });

  it("classic cubre 1900-1999, el mismo tramo que el resto de familias", () => {
    expect(openLibraryYearRange("classic")).toEqual({ from: 1900, to: 1999 });
  });

  it("un valor desconocido no produce filtro en vez de inventarlo", () => {
    expect(openLibraryYearRange("ayer")).toBeUndefined();
    expect(openLibraryYearRange("")).toBeUndefined();
    expect(openLibraryYearRange(null)).toBeUndefined();
  });
});

describe("openLibrarySort", () => {
  it("mapea los sorts con equivalente nativo", () => {
    expect(openLibrarySort("release_desc")).toBe("new");
    expect(openLibrarySort("release_asc")).toBe("old");
    expect(openLibrarySort("rating")).toBe("rating");
  });

  it("sin equivalente nativo no inventa un orden", () => {
    expect(openLibrarySort("popularidad")).toBeUndefined();
    expect(openLibrarySort("titulo")).toBeUndefined();
    expect(openLibrarySort(null)).toBeUndefined();
  });
});

describe("openLibraryFulltext", () => {
  it('solo "libre" acota; Open Library no distingue ebook de pago de físico', () => {
    expect(openLibraryFulltext("free")).toBe("true");
    expect(openLibraryFulltext("ebook")).toBeUndefined();
    expect(openLibraryFulltext("physical")).toBeUndefined();
  });
});

describe("buildOpenLibraryQuery", () => {
  it("sin filtros → semilla amplia y el idioma del locale", () => {
    expect(buildOpenLibraryQuery({}, "es")).toEqual({
      q: OPEN_LIBRARY_BASE_QUERY,
      params: { language: "spa" },
    });
  });

  it("el idioma viaja SIEMPRE: es lo que fija el título que se lee", () => {
    const { params } = buildOpenLibraryQuery({ genre: ["fantasia"] }, "en");
    expect(params.language).toBe("eng");
  });

  it("género y año se combinan en la consulta", () => {
    const { q } = buildOpenLibraryQuery({
      genre: ["ciencia-ficcion"],
      year: "2020s",
    });
    expect(q).toBe(
      'subject:"science fiction" first_publish_year:[2020 TO 2029]'
    );
  });

  it("varios géneros producen un fragmento cada uno", () => {
    const { q } = buildOpenLibraryQuery({ genre: ["fantasia", "terror"] });
    expect(q).toBe('subject:"fantasy" subject:"horror"');
  });

  it("un género desconocido se ignora en vez de romper la consulta", () => {
    const { q } = buildOpenLibraryQuery({ genre: ["noexiste"] });
    expect(q).toBe(OPEN_LIBRARY_BASE_QUERY);
  });

  it("el override de idioma manda sobre el locale activo", () => {
    expect(buildOpenLibraryQuery({ idioma: "fre" }, "es").params.language).toBe(
      "fre"
    );
  });

  it("acepta el override en ISO-639-1, que es como lo mandaba la etapa anterior", () => {
    expect(buildOpenLibraryQuery({ idioma: "en" }, "es").params.language).toBe(
      "eng"
    );
  });

  it("un override ilegible no pisa el locale", () => {
    expect(
      buildOpenLibraryQuery({ idioma: "castellano" }, "es").params.language
    ).toBe("spa");
  });
});
