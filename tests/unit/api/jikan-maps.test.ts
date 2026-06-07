// ============================================================
// KULTURA — Jikan filter translation tests (E59 F3b)
// genre/demografia→genres (MAL IDs, OR), año→start/end_date, status por subtipo
// (anime vs manga), sort→order_by+sort, guard de desconocidos, hasJikanFilters.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildJikanDiscoverParams,
  jikanStatus,
  jikanSort,
  jikanDateRange,
  hasJikanFilters,
  volumenesMin,
  filterByMinVolumes,
} from "@/lib/api/jikan-maps";
import type { MediaItem } from "@/types/media";

// ── status por subtipo ──────────────────────────────────────────────────────

describe("jikanStatus — distinto por subtipo", () => {
  it("anime: airing/complete/upcoming 1:1", () => {
    expect(jikanStatus("anime", "airing")).toBe("airing");
    expect(jikanStatus("anime", "complete")).toBe("complete");
    expect(jikanStatus("anime", "upcoming")).toBe("upcoming");
  });

  it("anime: 'publishing' (solo-manga) se descarta", () => {
    expect(jikanStatus("anime", "publishing")).toBeNull();
    expect(jikanStatus("anime", "hiatus")).toBeNull();
  });

  it("manga: canónico 'airing' → 'publishing'", () => {
    expect(jikanStatus("manga", "airing")).toBe("publishing");
  });

  it("manga: complete/upcoming 1:1 y passthrough nativos", () => {
    expect(jikanStatus("manga", "complete")).toBe("complete");
    expect(jikanStatus("manga", "upcoming")).toBe("upcoming");
    expect(jikanStatus("manga", "hiatus")).toBe("hiatus");
    expect(jikanStatus("manga", "discontinued")).toBe("discontinued");
    expect(jikanStatus("manga", "publishing")).toBe("publishing");
  });

  it("vacío / desconocido → null", () => {
    expect(jikanStatus("anime", null)).toBeNull();
    expect(jikanStatus("manga", "zzz")).toBeNull();
  });
});

// ── sort ─────────────────────────────────────────────────────────────────────

describe("jikanSort", () => {
  it("mapea claves canónicas a order_by + sort", () => {
    expect(jikanSort("popularity")).toEqual({
      order_by: "popularity",
      sort: "asc",
    });
    expect(jikanSort("rating")).toEqual({ order_by: "score", sort: "desc" });
    expect(jikanSort("release_desc")).toEqual({
      order_by: "start_date",
      sort: "desc",
    });
    expect(jikanSort("title_az")).toEqual({ order_by: "title", sort: "asc" });
  });

  it("desconocido / null → popularity default", () => {
    expect(jikanSort("xyz")).toEqual({ order_by: "popularity", sort: "asc" });
    expect(jikanSort(null)).toEqual({ order_by: "popularity", sort: "asc" });
  });
});

// ── año / década ───────────────────────────────────────────────────────────────

describe("jikanDateRange", () => {
  it("año exacto y década", () => {
    expect(jikanDateRange("2024")).toEqual({
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    });
    expect(jikanDateRange("2010s")).toEqual({
      start_date: "2010-01-01",
      end_date: "2019-12-31",
    });
  });

  it("classic y desconocido", () => {
    expect(jikanDateRange("classic")).toEqual({
      start_date: "1900-01-01",
      end_date: "1999-12-31",
    });
    expect(jikanDateRange("nope")).toBeNull();
    expect(jikanDateRange(null)).toBeNull();
  });
});

// ── buildJikanDiscoverParams ─────────────────────────────────────────────────

describe("buildJikanDiscoverParams", () => {
  it("sin filtros → solo order_by/sort default", () => {
    expect(buildJikanDiscoverParams("anime")).toEqual({
      order_by: "popularity",
      sort: "asc",
    });
  });

  it("género único → genres con MAL ID", () => {
    const p = buildJikanDiscoverParams("anime", { genre: ["accion"] });
    expect(p.genres).toBe("1");
  });

  it("multi-género → OR con coma", () => {
    const p = buildJikanDiscoverParams("anime", {
      genre: ["accion", "comedia", "drama"],
    });
    expect(p.genres).toBe("1,4,8");
  });

  it("demografía se añade al CSV de genres (es genre ID MAL)", () => {
    const p = buildJikanDiscoverParams("manga", {
      genre: ["accion"],
      demografia: "seinen",
    });
    expect(p.genres).toBe("1,42");
  });

  it("solo demografía → genres con su ID", () => {
    const p = buildJikanDiscoverParams("anime", { demografia: "shonen" });
    expect(p.genres).toBe("27");
  });

  it("año → start_date/end_date", () => {
    const p = buildJikanDiscoverParams("anime", { year: "2020s" });
    expect(p.start_date).toBe("2020-01-01");
    expect(p.end_date).toBe("2029-12-31");
  });

  it("status manga: airing→publishing", () => {
    expect(
      buildJikanDiscoverParams("manga", { status: "airing" }).status
    ).toBe("publishing");
  });

  it("status anime: airing→airing", () => {
    expect(
      buildJikanDiscoverParams("anime", { status: "airing" }).status
    ).toBe("airing");
  });

  it("status inválido para subtipo se descarta (sin param status)", () => {
    const p = buildJikanDiscoverParams("anime", { status: "hiatus" });
    expect(p.status).toBeUndefined();
  });

  it("género desconocido se ignora", () => {
    const p = buildJikanDiscoverParams("anime", {
      genre: ["accion", "inexistente"],
    });
    expect(p.genres).toBe("1");
  });

  it("sort canónico se refleja en order_by/sort", () => {
    const p = buildJikanDiscoverParams("anime", { sort: "rating" });
    expect(p.order_by).toBe("score");
    expect(p.sort).toBe("desc");
  });

  it("valoracion → min_score con el umbral (R4b nativo, anime y manga)", () => {
    expect(buildJikanDiscoverParams("anime", { valoracion: "8" }).min_score).toBe(
      "8"
    );
    expect(buildJikanDiscoverParams("manga", { valoracion: "7" }).min_score).toBe(
      "7"
    );
  });

  it("valoracion desconocida/vacía se ignora (sin min_score)", () => {
    expect(
      buildJikanDiscoverParams("anime", { valoracion: "99" }).min_score
    ).toBeUndefined();
    expect(buildJikanDiscoverParams("anime").min_score).toBeUndefined();
  });
});

// ── hasJikanFilters ────────────────────────────────────────────────────────────

describe("hasJikanFilters", () => {
  it("false sin filtros o con sort=popularity (default)", () => {
    expect(hasJikanFilters({})).toBe(false);
    expect(hasJikanFilters({ sort: "popularity" })).toBe(false);
    expect(hasJikanFilters({ genre: [] })).toBe(false);
  });

  it("true con cualquier filtro real (incluido sort no-default)", () => {
    expect(hasJikanFilters({ genre: ["accion"] })).toBe(true);
    expect(hasJikanFilters({ demografia: "shonen" })).toBe(true);
    expect(hasJikanFilters({ year: "2020s" })).toBe(true);
    expect(hasJikanFilters({ status: "airing" })).toBe(true);
    expect(hasJikanFilters({ sort: "rating" })).toBe(true);
    expect(hasJikanFilters({ valoracion: "8" })).toBe(true);
  });

  it("volumenes NO dispara endpoint de búsqueda (es post-filtro)", () => {
    expect(hasJikanFilters({ volumenes: "20plus" })).toBe(false);
  });
});

// ── Volúmenes (post-filtro manga) ───────────────────────────────────────────────

describe("volumenesMin", () => {
  it("buckets canónicos → umbral mínimo", () => {
    expect(volumenesMin("1-5")).toBe(1);
    expect(volumenesMin("6-20")).toBe(6);
    expect(volumenesMin("20plus")).toBe(20);
  });

  it("vacío / desconocido → null", () => {
    expect(volumenesMin(null)).toBeNull();
    expect(volumenesMin(undefined)).toBeNull();
    expect(volumenesMin("zzz")).toBeNull();
  });
});

describe("filterByMinVolumes", () => {
  const items = [
    { id: "manga_1", metadata: { volumes: 3 } },
    { id: "manga_2", metadata: { volumes: 10 } },
    { id: "manga_3", metadata: { volumes: 30 } },
    { id: "manga_4", metadata: { volumes: undefined } },
    { id: "manga_5", metadata: {} },
  ] as MediaItem[];

  it("'6-20' → conserva >= 6, descarta menores y sin volumes", () => {
    expect(filterByMinVolumes(items, "6-20").map((i) => i.id)).toEqual([
      "manga_2",
      "manga_3",
    ]);
  });

  it("'20plus' → solo >= 20", () => {
    expect(filterByMinVolumes(items, "20plus").map((i) => i.id)).toEqual([
      "manga_3",
    ]);
  });

  it("bucket vacío/desconocido → items intactos (no filtra)", () => {
    expect(filterByMinVolumes(items, null)).toHaveLength(5);
    expect(filterByMinVolumes(items, "zzz")).toHaveLength(5);
  });
});
