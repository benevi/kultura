// ============================================================
// KULTURA — ComicVine filter translation tests (E59 F3c)
// sort→sort param, year→filter cover_date:a|b, editorial→substrings publisher,
// hasComicFilters, guard de desconocidos. genre oculto (no entra en ComicFilters).
// ============================================================

import { describe, it, expect } from "vitest";
import {
  comicSort,
  comicCoverDateRange,
  COMIC_PUBLISHER,
  mapPublisherSubstrings,
  hasComicFilters,
} from "@/lib/api/comicvine-maps";

// ── comicSort ──────────────────────────────────────────────────────────────────

describe("comicSort", () => {
  it("recientes / newest / release_desc → cover_date:desc", () => {
    expect(comicSort("recientes")).toBe("cover_date:desc");
    expect(comicSort("newest")).toBe("cover_date:desc");
    expect(comicSort("release_desc")).toBe("cover_date:desc");
  });

  it("antiguos / release_asc → cover_date:asc", () => {
    expect(comicSort("antiguos")).toBe("cover_date:asc");
    expect(comicSort("release_asc")).toBe("cover_date:asc");
  });

  it("name / alfabetico / title_az → name:asc; title_za → name:desc", () => {
    expect(comicSort("name")).toBe("name:asc");
    expect(comicSort("alfabetico")).toBe("name:asc");
    expect(comicSort("title_az")).toBe("name:asc");
    expect(comicSort("title_za")).toBe("name:desc");
  });

  it("popularity / rating / desconocido / null → default cover_date:desc", () => {
    expect(comicSort("popularity")).toBe("cover_date:desc");
    expect(comicSort("rating")).toBe("cover_date:desc");
    expect(comicSort("xyz")).toBe("cover_date:desc");
    expect(comicSort(null)).toBe("cover_date:desc");
  });
});

// ── comicCoverDateRange ────────────────────────────────────────────────────────

describe("comicCoverDateRange", () => {
  it("año exacto, década, classic → cover_date:a|b", () => {
    expect(comicCoverDateRange("2024")).toBe(
      "cover_date:2024-01-01|2024-12-31"
    );
    expect(comicCoverDateRange("2010s")).toBe(
      "cover_date:2010-01-01|2019-12-31"
    );
    expect(comicCoverDateRange("classic")).toBe(
      "cover_date:1900-01-01|1999-12-31"
    );
  });

  it("vacío / inválido → null", () => {
    expect(comicCoverDateRange(null)).toBeNull();
    expect(comicCoverDateRange("abc")).toBeNull();
  });
});

// ── COMIC_PUBLISHER / mapPublisherSubstrings ───────────────────────────────────

describe("COMIC_PUBLISHER", () => {
  it("mapea slugs canónicos a substrings de publisher", () => {
    expect(COMIC_PUBLISHER.marvel).toBe("Marvel");
    expect(COMIC_PUBLISHER.dc).toBe("DC");
    expect(COMIC_PUBLISHER.image).toBe("Image");
    expect(COMIC_PUBLISHER["dark-horse"]).toBe("Dark Horse");
  });
});

describe("mapPublisherSubstrings", () => {
  it("traduce slugs conocidos, descarta desconocidos", () => {
    expect(mapPublisherSubstrings(["marvel", "dc"])).toEqual(["Marvel", "DC"]);
    expect(mapPublisherSubstrings(["marvel", "nope"])).toEqual(["Marvel"]);
  });

  it("vacío / undefined → []", () => {
    expect(mapPublisherSubstrings([])).toEqual([]);
    expect(mapPublisherSubstrings(undefined)).toEqual([]);
  });
});

// ── hasComicFilters ────────────────────────────────────────────────────────────

describe("hasComicFilters", () => {
  it("sin filtros → false", () => {
    expect(hasComicFilters()).toBe(false);
    expect(hasComicFilters({})).toBe(false);
  });

  it("year / editorial → true", () => {
    expect(hasComicFilters({ year: "2020" })).toBe(true);
    expect(hasComicFilters({ editorial: ["marvel"] })).toBe(true);
  });

  it("sort que cambia el default → true; cover_date:desc-equivalente → false", () => {
    expect(hasComicFilters({ sort: "release_asc" })).toBe(true);
    expect(hasComicFilters({ sort: "title_az" })).toBe(true);
    expect(hasComicFilters({ sort: "release_desc" })).toBe(false);
    expect(hasComicFilters({ sort: "popularity" })).toBe(false);
  });

  it("editorial vacío no cuenta", () => {
    expect(hasComicFilters({ editorial: [] })).toBe(false);
  });
});
