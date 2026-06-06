// ============================================================
// KULTURA — RAWG filter translation tests (E59 F3b)
// genre→genres (slugs, OR), platform→platforms (IDs, OR), año→dates rango,
// sort→ordering, status/horas ignorados (oculto game), guard de desconocidos.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildRawgDiscoverParams,
  rawgOrdering,
  rawgDates,
} from "@/lib/api/rawg-maps";

// ── ordering ─────────────────────────────────────────────────────────────────

describe("rawgOrdering", () => {
  it("claves canónicas → ordering RAWG", () => {
    expect(rawgOrdering("popularity")).toBe("-added");
    expect(rawgOrdering("rating")).toBe("-rating");
    expect(rawgOrdering("release_desc")).toBe("-released");
    expect(rawgOrdering("title_az")).toBe("name");
  });

  it("desconocido / null → -added default", () => {
    expect(rawgOrdering("xyz")).toBe("-added");
    expect(rawgOrdering(null)).toBe("-added");
  });
});

// ── dates ────────────────────────────────────────────────────────────────────

describe("rawgDates", () => {
  it("año exacto, década, classic", () => {
    expect(rawgDates("2024")).toBe("2024-01-01,2024-12-31");
    expect(rawgDates("2010s")).toBe("2010-01-01,2019-12-31");
    expect(rawgDates("classic")).toBe("1900-01-01,1999-12-31");
  });

  it("vacío / inválido → null", () => {
    expect(rawgDates(null)).toBeNull();
    expect(rawgDates("abc")).toBeNull();
  });
});

// ── buildRawgDiscoverParams ──────────────────────────────────────────────────

describe("buildRawgDiscoverParams", () => {
  it("sin filtros → solo ordering default", () => {
    expect(buildRawgDiscoverParams()).toEqual({ ordering: "-added" });
  });

  it("género → genres con slug RAWG", () => {
    const p = buildRawgDiscoverParams({ genre: ["accion"] });
    expect(p.genres).toBe("action");
  });

  it("multi-género → OR con coma (slugs RAWG)", () => {
    const p = buildRawgDiscoverParams({ genre: ["accion", "rpg", "indie"] });
    expect(p.genres).toBe("action,role-playing-games-rpg,indie");
  });

  it("plataforma → platforms con IDs (OR)", () => {
    const p = buildRawgDiscoverParams({ platform: ["pc", "ps5", "switch"] });
    expect(p.platforms).toBe("4,187,7");
  });

  it("año → dates rango", () => {
    const p = buildRawgDiscoverParams({ year: "2020s" });
    expect(p.dates).toBe("2020-01-01,2029-12-31");
  });

  it("sort → ordering", () => {
    expect(buildRawgDiscoverParams({ sort: "rating" }).ordering).toBe(
      "-rating"
    );
  });

  it("status y horas se IGNORAN (oculto para game)", () => {
    // status/horas no están en RawgFilters; el builder no los lee aunque lleguen.
    const extra = {
      status: "airing",
      horas: "long",
      genre: ["accion"],
    } as Parameters<typeof buildRawgDiscoverParams>[0];
    const p = buildRawgDiscoverParams(extra);
    expect(p.genres).toBe("action");
    expect(p.status).toBeUndefined();
    expect(p.horas).toBeUndefined();
    // Solo ordering + genres, nada más.
    expect(Object.keys(p).sort()).toEqual(["genres", "ordering"]);
  });

  it("género/plataforma desconocidos se descartan", () => {
    const p = buildRawgDiscoverParams({
      genre: ["accion", "nope"],
      platform: ["pc", "zzz"],
    });
    expect(p.genres).toBe("action");
    expect(p.platforms).toBe("4");
  });
});
