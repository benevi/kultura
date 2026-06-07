// E59 · R2 — TYPE_FILTERS V2 + TYPE_ORDER (rediseño desde mockup)
// Contrato: docs/E59_FILTER_SPEC_V2.md. Verifica: orden con "all", matriz por
// tipo en orden, kinds (single/multi/searchable), sort align:'end' en todos,
// postFilter flags, y los 5 ocultos AUSENTES (política A).

import { describe, it, expect } from "vitest";
import {
  TYPE_ORDER,
  TYPE_FILTERS,
  type DiscoverType,
  type FilterTrigger,
} from "@/lib/discover/type-filters";
import { VALID_TYPES, parseDiscoverParams } from "@/lib/api/discover-params";

const ALL_TYPES: DiscoverType[] = [
  "all",
  "movie",
  "tv",
  "anime",
  "book",
  "manga",
  "game",
  "comic",
];

function keysOf(type: DiscoverType): string[] {
  return TYPE_FILTERS[type].map((t) => t.key);
}

function find(type: DiscoverType, key: string): FilterTrigger | undefined {
  return TYPE_FILTERS[type].find((t) => t.key === key);
}

describe("TYPE_ORDER", () => {
  it("empieza por 'all' y sigue el orden del mockup", () => {
    expect(TYPE_ORDER).toEqual([
      "all",
      "movie",
      "tv",
      "anime",
      "book",
      "manga",
      "game",
      "comic",
    ]);
  });

  it("no tiene duplicados", () => {
    expect(new Set(TYPE_ORDER).size).toBe(TYPE_ORDER.length);
  });

  it("cubre VALID_TYPES del parser + el agregado 'all'", () => {
    const withoutAll = TYPE_ORDER.filter((t) => t !== "all");
    expect([...withoutAll].sort()).toEqual([...VALID_TYPES].sort());
    expect(TYPE_ORDER).toContain("all");
  });
});

describe("TYPE_FILTERS — matriz por tipo en orden (spec V2)", () => {
  it("define un set para los 8 tipos (incl. 'all')", () => {
    expect(Object.keys(TYPE_FILTERS).sort()).toEqual([...ALL_TYPES].sort());
  });

  const expected: Record<DiscoverType, string[]> = {
    all: ["genre", "year", "valoracion", "platform", "sort"],
    movie: ["genre", "year", "valoracion", "duracion", "platform", "idioma", "sort"],
    tv: ["genre", "year", "valoracion", "status", "temporadas", "platform", "idioma", "sort"],
    anime: ["genre", "year", "valoracion", "demografia", "status", "idioma", "sort"],
    manga: ["genre", "year", "valoracion", "demografia", "status", "volumenes", "idioma", "sort"],
    book: ["genre", "year", "editorial", "formato", "idioma", "sort"],
    game: ["platform", "genre", "modojuego", "year", "valoracion", "duracionmedia", "estado", "sort"],
    // genre omitido en comic: ComicVine sin catálogo de género (ver type-filters.ts).
    comic: ["year", "editorial", "volumenes", "idioma", "sort"],
  };

  for (const type of ALL_TYPES) {
    it(`${type} expone los triggers esperados en orden`, () => {
      expect(keysOf(type)).toEqual(expected[type]);
    });
  }
});

describe("TYPE_FILTERS — sort align:'end' en todos los tipos", () => {
  it("sort cierra cada set", () => {
    for (const type of ALL_TYPES) {
      const keys = keysOf(type);
      expect(keys[keys.length - 1]).toBe("sort");
    }
  });

  it("sort es kind 'single' con align 'end'", () => {
    for (const type of ALL_TYPES) {
      const sort = find(type, "sort");
      expect(sort?.kind).toBe("single");
      expect(sort?.align).toBe("end");
    }
  });

  it("ningún trigger que no sea sort lleva align 'end'", () => {
    for (const type of ALL_TYPES) {
      for (const trig of TYPE_FILTERS[type]) {
        if (trig.key !== "sort") expect(trig.align).toBeUndefined();
      }
    }
  });
});

describe("TYPE_FILTERS — kinds correctos (FilterBar v3)", () => {
  it("genre y editorial son searchable", () => {
    expect(find("movie", "genre")?.kind).toBe("searchable");
    expect(find("book", "editorial")?.kind).toBe("searchable");
  });

  it("year, valoracion, duracion, temporadas, volumenes, duracionmedia son single", () => {
    expect(find("movie", "year")?.kind).toBe("single");
    expect(find("movie", "valoracion")?.kind).toBe("single");
    expect(find("movie", "duracion")?.kind).toBe("single");
    expect(find("tv", "temporadas")?.kind).toBe("single");
    expect(find("manga", "volumenes")?.kind).toBe("single");
    expect(find("game", "duracionmedia")?.kind).toBe("single");
  });

  it("platform, idioma, status, demografia, formato, modojuego, estado son multi", () => {
    expect(find("movie", "platform")?.kind).toBe("multi");
    expect(find("movie", "idioma")?.kind).toBe("multi");
    expect(find("tv", "status")?.kind).toBe("multi");
    expect(find("anime", "demografia")?.kind).toBe("multi");
    expect(find("book", "formato")?.kind).toBe("multi");
    expect(find("game", "modojuego")?.kind).toBe("multi");
    expect(find("game", "estado")?.kind).toBe("multi");
  });

  it("no quedan kinds legacy 'min' ni 'menu'", () => {
    const VALID_KINDS = new Set(["single", "multi", "searchable"]);
    for (const type of ALL_TYPES) {
      for (const trig of TYPE_FILTERS[type]) {
        expect(VALID_KINDS.has(trig.kind)).toBe(true);
      }
    }
  });
});

describe("TYPE_FILTERS — 5 ocultos AUSENTES (política A)", () => {
  it("book/comic no muestran valoracion ni estado", () => {
    expect(keysOf("book")).not.toContain("valoracion");
    expect(keysOf("book")).not.toContain("estado");
    expect(keysOf("comic")).not.toContain("valoracion");
    expect(keysOf("comic")).not.toContain("estado");
  });

  it("book/comic no muestran status (estado nativo)", () => {
    expect(keysOf("book")).not.toContain("status");
    expect(keysOf("comic")).not.toContain("status");
  });

  it("anime no muestra temporadas", () => {
    expect(keysOf("anime")).not.toContain("temporadas");
  });
});

describe("TYPE_FILTERS — post-filters marcados (spec V2)", () => {
  it("temporadas, volumenes, editorial, modojuego, duracionmedia, estado(game) y valoracion(game) llevan postFilter", () => {
    expect(find("tv", "temporadas")?.postFilter).toBe(true);
    expect(find("manga", "volumenes")?.postFilter).toBe(true);
    expect(find("book", "editorial")?.postFilter).toBe(true);
    expect(find("game", "modojuego")?.postFilter).toBe(true);
    expect(find("game", "duracionmedia")?.postFilter).toBe(true);
    expect(find("game", "estado")?.postFilter).toBe(true);
    expect(find("game", "valoracion")?.postFilter).toBe(true);
  });

  it("triggers nativos NO llevan postFilter", () => {
    // valoracion es nativo en movie/tv/anime/manga (no game).
    expect(find("movie", "valoracion")?.postFilter).toBeUndefined();
    expect(find("tv", "valoracion")?.postFilter).toBeUndefined();
    expect(find("movie", "genre")?.postFilter).toBeUndefined();
    expect(find("movie", "platform")?.postFilter).toBeUndefined();
    expect(find("tv", "status")?.postFilter).toBeUndefined();
  });
});

describe("TYPE_FILTERS — paramKey", () => {
  // paramKeys nuevos del rediseño (R2) que el backend aún NO parsea: se aplican
  // server-side en R4. Exentos del sondeo al parser hasta entonces.
  const R4_PENDING = new Set(["rating", "seasons", "gamemode", "playtime", "estado"]);

  const allParamKeys = new Set<string>();
  for (const type of ALL_TYPES) {
    for (const trig of TYPE_FILTERS[type]) allParamKeys.add(trig.paramKey);
  }

  for (const paramKey of Array.from(allParamKeys)) {
    if (R4_PENDING.has(paramKey)) continue;
    it(`'${paramKey}' es un campo que parseDiscoverParams reconoce`, () => {
      const parsed = parseDiscoverParams(
        new URLSearchParams(`type=movie&${paramKey}=x`)
      );
      expect(parsed).toHaveProperty(paramKey);
    });
  }

  it("los paramKeys nuevos (R4-pending) están registrados pero no rotos", () => {
    expect(allParamKeys.has("rating")).toBe(true);
    expect(allParamKeys.has("seasons")).toBe(true);
    expect(allParamKeys.has("gamemode")).toBe(true);
    expect(allParamKeys.has("playtime")).toBe(true);
  });
});
