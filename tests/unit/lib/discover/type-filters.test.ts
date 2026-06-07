// E59 · F5a — TYPE_FILTERS central + TYPE_ORDER
// Verifica: orden canónico cubre los 7 tipos sin duplicados; cada tipo expone
// los triggers de la matriz (spec §4) y NINGÚN trigger oculto; paramKey de cada
// trigger ∈ params que parsea discover-params.ts.

import { describe, it, expect } from "vitest";
import {
  TYPE_ORDER,
  TYPE_FILTERS,
  type FilterTrigger,
} from "@/lib/discover/type-filters";
import { VALID_TYPES, parseDiscoverParams } from "@/lib/api/discover-params";
import type { MediaType } from "@/types/media";

const ALL_TYPES: MediaType[] = [
  "movie",
  "tv",
  "anime",
  "book",
  "comic",
  "manga",
  "game",
];

function keysOf(type: MediaType): string[] {
  return TYPE_FILTERS[type].map((t) => t.key);
}

describe("TYPE_ORDER", () => {
  it("cubre exactamente los 7 MediaType", () => {
    expect(TYPE_ORDER).toHaveLength(7);
    expect([...TYPE_ORDER].sort()).toEqual([...ALL_TYPES].sort());
  });

  it("no tiene duplicados", () => {
    expect(new Set(TYPE_ORDER).size).toBe(TYPE_ORDER.length);
  });

  it("cubre el mismo SET que VALID_TYPES del parser (allowlist)", () => {
    expect([...TYPE_ORDER].sort()).toEqual([...VALID_TYPES].sort());
  });
});

describe("TYPE_FILTERS — cobertura por tipo (spec §4)", () => {
  it("define un set para cada uno de los 7 tipos", () => {
    expect(Object.keys(TYPE_FILTERS).sort()).toEqual([...ALL_TYPES].sort());
  });

  const expected: Record<MediaType, string[]> = {
    movie: ["genre", "year", "platform", "duracion", "idioma", "sort"],
    tv: ["genre", "year", "platform", "status", "idioma", "sort"],
    anime: ["genre", "year", "status", "demografia", "sort"],
    manga: ["genre", "year", "status", "demografia", "volumenes", "sort"],
    book: ["genre", "formato", "idioma", "sort"],
    comic: ["year", "editorial", "sort"],
    game: ["genre", "year", "platform", "sort"],
  };

  for (const type of ALL_TYPES) {
    it(`${type} expone los triggers esperados en orden`, () => {
      expect(keysOf(type)).toEqual(expected[type]);
    });
  }

  it("sort cierra todos los sets", () => {
    for (const type of ALL_TYPES) {
      const keys = keysOf(type);
      expect(keys[keys.length - 1]).toBe("sort");
    }
  });

  it("sort es de kind 'menu' en todos los tipos (F5c)", () => {
    for (const type of ALL_TYPES) {
      const sort = TYPE_FILTERS[type].find((t) => t.key === "sort");
      expect(sort?.kind).toBe("menu");
    }
  });
});

describe("TYPE_FILTERS — triggers ocultos NO aparecen (matriz §2)", () => {
  it("movie no muestra status, temporadas ni volumenes", () => {
    const k = keysOf("movie");
    expect(k).not.toContain("status");
    expect(k).not.toContain("temporadas");
    expect(k).not.toContain("volumenes");
  });

  it("tv no muestra temporadas (fuera de F1, post N+1) ni duracion", () => {
    const k = keysOf("tv");
    expect(k).not.toContain("temporadas");
    expect(k).not.toContain("duracion");
  });

  it("anime no muestra volumenes ni platform", () => {
    const k = keysOf("anime");
    expect(k).not.toContain("volumenes");
    expect(k).not.toContain("platform");
  });

  it("book no muestra year (Books no filtra año nativo) ni platform", () => {
    const k = keysOf("book");
    expect(k).not.toContain("year");
    expect(k).not.toContain("platform");
  });

  it("comic no muestra genre (ComicVine sin género en issues) ni platform", () => {
    const k = keysOf("comic");
    expect(k).not.toContain("genre");
    expect(k).not.toContain("platform");
  });

  it("game no muestra horas (degradado/oculto en F1) ni status", () => {
    const k = keysOf("game");
    expect(k).not.toContain("horas");
    expect(k).not.toContain("status");
  });

  it("ningún tipo expone temporadas ni horas (degradado/oculto en F1)", () => {
    for (const type of ALL_TYPES) {
      const k = keysOf(type);
      expect(k).not.toContain("temporadas");
      expect(k).not.toContain("horas");
    }
  });
});

describe("TYPE_FILTERS — post-filters marcados", () => {
  function find(type: MediaType, key: string): FilterTrigger | undefined {
    return TYPE_FILTERS[type].find((t) => t.key === key);
  }

  it("volumenes (manga) y editorial (comic) llevan postFilter=true", () => {
    expect(find("manga", "volumenes")?.postFilter).toBe(true);
    expect(find("comic", "editorial")?.postFilter).toBe(true);
  });

  it("los triggers nativos NO llevan postFilter", () => {
    for (const type of ALL_TYPES) {
      for (const trig of TYPE_FILTERS[type]) {
        if (trig.key !== "volumenes" && trig.key !== "editorial") {
          expect(trig.postFilter).toBeUndefined();
        }
      }
    }
  });
});

describe("TYPE_FILTERS — paramKey ∈ params parseados", () => {
  // Construye un set de claves reconocidas por el parser canónico, sondeándolo
  // con cada paramKey usado en TYPE_FILTERS.
  const allParamKeys = new Set<string>();
  for (const type of ALL_TYPES) {
    for (const trig of TYPE_FILTERS[type]) allParamKeys.add(trig.paramKey);
  }

  for (const paramKey of Array.from(allParamKeys)) {
    it(`'${paramKey}' es un campo que parseDiscoverParams reconoce`, () => {
      const parsed = parseDiscoverParams(
        new URLSearchParams(`type=movie&${paramKey}=x`)
      );
      // El parser materializa cada param reconocido como propiedad del contrato.
      expect(parsed).toHaveProperty(paramKey);
    });
  }
});
