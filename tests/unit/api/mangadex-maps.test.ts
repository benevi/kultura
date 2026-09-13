// ============================================================
// KULTURA — mangadex-maps.ts unit tests (E-MANGA-SOURCE)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildMangaDexDiscoverParams,
  hasMangaDexFilters,
  filterByMinVolumesDex,
  MANGADEX_GENRE,
  MANGADEX_DEMOGRAPHIC,
  MANGADEX_STATUS,
} from "@/lib/api/mangadex-maps";
import type { MediaItem } from "@/types/media";

function findParam(params: [string, string][], key: string): string[] {
  return params.filter(([k]) => k === key).map(([, v]) => v);
}

describe("buildMangaDexDiscoverParams", () => {
  it("siempre incluye contentRating[]=safe,suggestive (SFW por defecto)", () => {
    const params = buildMangaDexDiscoverParams({});
    expect(findParam(params, "contentRating[]")).toEqual([
      "safe",
      "suggestive",
    ]);
  });

  it("sin filtros → sort default popularity → order[followedCount]=desc", () => {
    const params = buildMangaDexDiscoverParams({});
    expect(findParam(params, "order[followedCount]")).toEqual(["desc"]);
  });

  it("genre: traduce slugs canónicos a tag UUIDs vía includedTags[]", () => {
    const params = buildMangaDexDiscoverParams({ genre: ["accion", "drama"] });
    expect(findParam(params, "includedTags[]")).toEqual([
      MANGADEX_GENRE.accion,
      MANGADEX_GENRE.drama,
    ]);
  });

  it("genre desconocido → se omite sin romper la query", () => {
    const params = buildMangaDexDiscoverParams({ genre: ["no-existe"] });
    expect(findParam(params, "includedTags[]")).toEqual([]);
  });

  it("demografia: shonen → publicationDemographic[]=shounen", () => {
    const params = buildMangaDexDiscoverParams({ demografia: "shonen" });
    expect(findParam(params, "publicationDemographic[]")).toEqual([
      MANGADEX_DEMOGRAPHIC.shonen,
    ]);
  });

  it("demografia='kids' (sin equivalente MangaDex) → no filtra, no rompe", () => {
    const params = buildMangaDexDiscoverParams({ demografia: "kids" });
    expect(findParam(params, "publicationDemographic[]")).toEqual([]);
  });

  it("status: airing/publishing → status[]=ongoing", () => {
    expect(
      findParam(
        buildMangaDexDiscoverParams({ status: "airing" }),
        "status[]"
      )
    ).toEqual([MANGADEX_STATUS.airing]);
    expect(
      findParam(
        buildMangaDexDiscoverParams({ status: "publishing" }),
        "status[]"
      )
    ).toEqual([MANGADEX_STATUS.publishing]);
  });

  it("status='upcoming' (sin equivalente MangaDex) → no filtra", () => {
    const params = buildMangaDexDiscoverParams({ status: "upcoming" });
    expect(findParam(params, "status[]")).toEqual([]);
  });

  it("year: 4 dígitos → param year exacto", () => {
    const params = buildMangaDexDiscoverParams({ year: "2020" });
    expect(findParam(params, "year")).toEqual(["2020"]);
  });

  it("year inválido (década/'classic') → se omite (MangaDex no soporta rango)", () => {
    const params = buildMangaDexDiscoverParams({ year: "1990s" });
    expect(findParam(params, "year")).toEqual([]);
  });

  it("sort='rating' → order[rating]=desc", () => {
    const params = buildMangaDexDiscoverParams({ sort: "rating" });
    expect(findParam(params, "order[rating]")).toEqual(["desc"]);
  });

  it("sort='title_az' → order[title]=asc", () => {
    const params = buildMangaDexDiscoverParams({ sort: "title_az" });
    expect(findParam(params, "order[title]")).toEqual(["asc"]);
  });
});

describe("hasMangaDexFilters", () => {
  it("false sin filtros", () => {
    expect(hasMangaDexFilters({})).toBe(false);
  });

  it("false con sort='popularity' (default, no dispara búsqueda con params)", () => {
    expect(hasMangaDexFilters({ sort: "popularity" })).toBe(false);
  });

  it("true con genre/demografia/status/year/sort-no-default", () => {
    expect(hasMangaDexFilters({ genre: ["accion"] })).toBe(true);
    expect(hasMangaDexFilters({ demografia: "shonen" })).toBe(true);
    expect(hasMangaDexFilters({ status: "complete" })).toBe(true);
    expect(hasMangaDexFilters({ year: "2020" })).toBe(true);
    expect(hasMangaDexFilters({ sort: "rating" })).toBe(true);
  });
});

describe("filterByMinVolumesDex", () => {
  const items = [
    { id: "manga_1", metadata: { volumes: 3 } },
    { id: "manga_2", metadata: { volumes: 10 } },
    { id: "manga_3", metadata: {} },
  ] as MediaItem[];

  it("bucket '6-20' → descarta < 6 y sin volumes resuelto", () => {
    const result = filterByMinVolumesDex(items, "6-20");
    expect(result.map((i) => i.id)).toEqual(["manga_2"]);
  });

  it("sin bucket → no filtra", () => {
    expect(filterByMinVolumesDex(items, null)).toHaveLength(3);
  });
});
