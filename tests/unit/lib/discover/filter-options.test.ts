// E59 · F5d — Capa de opciones de filtros (getFilterOptions + humanizeSlug)
// Verifica: cada trigger de TYPE_FILTERS[type] tiene opciones no vacías;
// dispatch correcto por catálogo (game.platform=RAWG, status anime≠manga,
// genre movie≠anime); todo value es string no vacío y sin duplicados.

import { describe, it, expect } from "vitest";
import {
  getFilterOptions,
  humanizeSlug,
} from "@/lib/discover/filter-options";
import { TYPE_ORDER, TYPE_FILTERS } from "@/lib/discover/type-filters";
import { RAWG_PLATFORM, RAWG_GENRE } from "@/lib/api/rawg-maps";
import { TMDB_PROVIDER, TMDB_GENRE_MOVIE } from "@/lib/api/tmdb-maps";
import { JIKAN_GENRE } from "@/lib/api/jikan-maps";

const valuesOf = (type: Parameters<typeof getFilterOptions>[0], key: string) =>
  getFilterOptions(type, key).map((o) => o.value);

describe("humanizeSlug", () => {
  it("title-caseas separando - y _", () => {
    expect(humanizeSlug("title_az")).toBe("Title Az");
    expect(humanizeSlug("ciencia-ficcion")).toBe("Ciencia Ficcion");
  });

  it("deja números/buckets razonables", () => {
    expect(humanizeSlug("20plus")).toBe("20plus");
    expect(humanizeSlug("1-5")).toBe("1 5");
  });
});

// `year` no tiene catálogo: son buckets free-form (YYYY/década/classic) que el
// UI inyecta directamente, no opciones de un Record. F5d no lo cubre.
const CATALOG_TRIGGERS = (type: (typeof TYPE_ORDER)[number]) =>
  TYPE_FILTERS[type].filter((t) => t.key !== "year");

describe("getFilterOptions — cobertura por TYPE_FILTERS", () => {
  for (const type of TYPE_ORDER) {
    for (const trigger of CATALOG_TRIGGERS(type)) {
      it(`${type}.${trigger.key} → opciones no vacías`, () => {
        const opts = getFilterOptions(type, trigger.key);
        expect(opts.length).toBeGreaterThan(0);
      });
    }
  }

  it("year no tiene catálogo (buckets free-form) → []", () => {
    expect(getFilterOptions("movie", "year")).toEqual([]);
  });
});

describe("getFilterOptions — invariantes de value", () => {
  for (const type of TYPE_ORDER) {
    for (const trigger of CATALOG_TRIGGERS(type)) {
      it(`${type}.${trigger.key} → values string no vacíos y únicos`, () => {
        const values = valuesOf(type, trigger.key);
        for (const v of values) {
          expect(typeof v).toBe("string");
          expect(v.length).toBeGreaterThan(0);
        }
        expect(new Set(values).size).toBe(values.length);
      });
    }
  }
});

describe("getFilterOptions — dispatch correcto por catálogo", () => {
  it("game.platform usa RAWG, no TMDB", () => {
    const game = new Set(valuesOf("game", "platform"));
    expect(game).toEqual(new Set(Object.keys(RAWG_PLATFORM)));
    expect(game.has("ps5")).toBe(true);
    // ningún value de TMDB providers (p.ej. netflix) en game.platform
    for (const tmdb of Object.keys(TMDB_PROVIDER)) {
      if (!(tmdb in RAWG_PLATFORM)) expect(game.has(tmdb)).toBe(false);
    }
  });

  it("movie.platform usa TMDB providers", () => {
    const movie = new Set(valuesOf("movie", "platform"));
    expect(movie).toEqual(new Set(Object.keys(TMDB_PROVIDER)));
    expect(movie.has("netflix")).toBe(true);
  });

  it("anime.status ⊃ {airing,complete} y difiere de manga.status", () => {
    const anime = valuesOf("anime", "status");
    const manga = valuesOf("manga", "status");
    expect(anime).toContain("airing");
    expect(anime).toContain("complete");
    expect(new Set(anime)).not.toEqual(new Set(manga));
    // manga tiene estados nativos extra (hiatus/discontinued/publishing).
    expect(manga.length).toBeGreaterThan(anime.length);
  });

  it("movie.genre ≠ anime.genre (catálogos distintos)", () => {
    const movie = new Set(valuesOf("movie", "genre"));
    const anime = new Set(valuesOf("anime", "genre"));
    expect(movie).toEqual(new Set(Object.keys(TMDB_GENRE_MOVIE)));
    expect(anime).toEqual(new Set(Object.keys(JIKAN_GENRE)));
    expect(movie).not.toEqual(anime);
  });

  it("game.genre usa RAWG", () => {
    expect(new Set(valuesOf("game", "genre"))).toEqual(
      new Set(Object.keys(RAWG_GENRE))
    );
  });
});

// E59 R1 — keys nuevas del rediseño V2 (aditivo). Solo verifica value
// correcto, longitud y no-vacío. Labels = placeholder humanizeSlug (i18n R6).
describe("getFilterOptions — keys nuevas E59 R1", () => {
  const CASES: Array<{ key: string; values: string[]; type?: string }> = [
    { key: "valoracion", values: ["9", "8", "7", "6"] },
    { key: "temporadas", values: ["1", "2-3", "4-6", "7plus"] },
    { key: "modojuego", values: ["single", "multi", "coop", "online"] },
    { key: "duracionmedia", values: ["lt10", "10-30", "30-60", "60plus"] },
    { key: "estado", values: ["early-access", "released"], type: "game" },
  ];

  for (const { key, values, type } of CASES) {
    const t = (type ?? "movie") as Parameters<typeof getFilterOptions>[0];
    it(`${key} → values exactos y no vacíos`, () => {
      const opts = getFilterOptions(t, key);
      expect(opts.length).toBe(values.length);
      expect(opts.length).toBeGreaterThan(0);
      expect(opts.map((o) => o.value)).toEqual(values);
      for (const o of opts) {
        expect(o.value.length).toBeGreaterThan(0);
        expect(o.label.length).toBeGreaterThan(0);
      }
    });
  }

  it("estado solo aplica a game (otros tipos → [])", () => {
    expect(getFilterOptions("movie", "estado")).toEqual([]);
    expect(getFilterOptions("tv", "estado")).toEqual([]);
  });
});
