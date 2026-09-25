// ============================================================
// KULTURA — Filtros → query de Open Library (E-BOOKS-HIBRIDO)
//
// Lo que se protege aquí es justo lo que Google Books NO sabía hacer y por lo
// que la pestaña de libros daba títulos en inglés y filtros vacíos: que el
// idioma y el año viajen COMO FILTROS al proveedor, no como un recorte
// posterior sobre lo ya recibido.
// ============================================================

import { describe, it, expect } from "vitest";
import { todayYear } from "@/lib/api/catalog-window";
import {
  buildOpenLibraryQuery,
  openLibraryYearRange,
  openLibrarySort,
  openLibraryLanguage,
  openLibraryFulltext,
  OPEN_LIBRARY_BASE_QUERY,
  OPEN_LIBRARY_SORT,
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

  // "popularidad" YA NO cae aquí: desde E-BOOKS-SORT se mapea a `readinglog`,
  // que es la señal de popularidad real de Open Library.
  it("sin equivalente nativo no inventa un orden", () => {
    expect(openLibrarySort("titulo")).toBeUndefined();
    expect(openLibrarySort("title_az")).toBeUndefined();
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
      q: `${OPEN_LIBRARY_BASE_QUERY} first_publish_year:[* TO ${todayYear()}]`,
      params: { language: "spa" },
    });
  });

  it("el idioma viaja SIEMPRE: es lo que fija el título que se lee", () => {
    const { params } = buildOpenLibraryQuery({ genre: ["fantasia"] }, "en");
    expect(params.language).toBe("eng");
  });

  // E-CATALOGO-FUTURO: toda consulta lleva un tope de año, así que la década en
  // curso se recorta al año actual (2020s ya no llega a 2029).
  it("género y año se combinan en la consulta, con el tope de hoy", () => {
    const { q } = buildOpenLibraryQuery({
      genre: ["ciencia-ficcion"],
      year: "2020s",
    });
    expect(q).toBe(
      `subject:"science fiction" first_publish_year:[2020 TO ${todayYear()}]`
    );
  });

  it("década ya cerrada → rango íntegro", () => {
    const { q } = buildOpenLibraryQuery({ year: "2000s" });
    expect(q).toBe(
      `${OPEN_LIBRARY_BASE_QUERY} first_publish_year:[2000 TO 2009]`
    );
  });

  it("varios géneros producen un fragmento cada uno", () => {
    const { q } = buildOpenLibraryQuery({ genre: ["fantasia", "terror"] });
    expect(q).toBe(
      `subject:"fantasy" subject:"horror" first_publish_year:[* TO ${todayYear()}]`
    );
  });

  it("un género desconocido se ignora en vez de romper la consulta", () => {
    const { q } = buildOpenLibraryQuery({ genre: ["noexiste"] });
    // La base sigue siendo la que manda cuando no queda ningún fragmento del
    // usuario: el tope se añade DESPUÉS, nunca la desplaza.
    expect(q).toBe(
      `${OPEN_LIBRARY_BASE_QUERY} first_publish_year:[* TO ${todayYear()}]`
    );
  });

  it("año futuro explícito se respeta sin recortar", () => {
    const { q } = buildOpenLibraryQuery({ year: "2099" });
    expect(q).toBe(
      `${OPEN_LIBRARY_BASE_QUERY} first_publish_year:[2099 TO 2099]`
    );
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

// ============================================================
// E-BOOKS-SORT — el desplegable de orden no puede mentir
//
// El catálogo de libros ofrecía las mismas opciones que TMDB, incluidas
// "Título A–Z" y "Título Z–A", que Open Library no sabe hacer. El resultado:
// se cambiaba el orden y salían exactamente los mismos libros.
// ============================================================

describe("OPEN_LIBRARY_SORT (E-BOOKS-SORT)", () => {
  it("no ofrece ordenar por título: Open Library no sabe hacerlo", () => {
    expect(OPEN_LIBRARY_SORT.title_az).toBeUndefined();
    expect(OPEN_LIBRARY_SORT.title_za).toBeUndefined();
  });

  it("toda opción ofrecida se traduce a un sort real del proveedor", () => {
    for (const key of Object.keys(OPEN_LIBRARY_SORT)) {
      expect(openLibrarySort(key)).toBeTruthy();
    }
  });

  it("popularidad usa el registro de lectura, que es señal real", () => {
    expect(openLibrarySort("popularity")).toBe("readinglog");
  });

  it("sigue entendiendo los alias que llegan de otros catálogos", () => {
    expect(openLibrarySort("recientes")).toBe("new");
    expect(openLibrarySort("valoracion")).toBe("rating");
    expect(openLibrarySort("popularidad")).toBe("readinglog");
  });

  it("un sort desconocido no inventa orden", () => {
    expect(openLibrarySort("title_az")).toBeUndefined();
    expect(openLibrarySort("loquesea")).toBeUndefined();
  });
});
