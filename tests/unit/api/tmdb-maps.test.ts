// ============================================================
// KULTURA — TMDB filter translation tests (E59 F3a)
// Verifica que cada filtro canónico produce el param nativo TMDB correcto:
// género (movie/tv distintos, OR), plataforma+region, idioma ISO, sort por
// tipo, año/década→rango, duración→runtime, status (tv) y guard de inválidos.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildTmdbDiscoverParams,
  tmdbSortBy,
  tmdbYearRange,
  tmdbRuntimeRange,
  filterTVByTemporadas,
} from "@/lib/api/tmdb-maps";
import type { MediaItem } from "@/types/media";

function tv(id: string, seasons: unknown): MediaItem {
  return {
    id: `tv_${id}`,
    externalId: id,
    type: "tv",
    title: id,
    metadata: { seasons },
  };
}

// ── sort_by ─────────────────────────────────────────────────────────────────

describe("tmdbSortBy", () => {
  it("movie: claves canónicas → sort_by", () => {
    expect(tmdbSortBy("movie", "popularity")).toBe("popularity.desc");
    expect(tmdbSortBy("movie", "rating")).toBe("vote_average.desc");
    expect(tmdbSortBy("movie", "release_desc")).toBe("primary_release_date.desc");
    expect(tmdbSortBy("movie", "title_az")).toBe("original_title.asc");
  });

  it("tv: usa first_air_date y original_name", () => {
    expect(tmdbSortBy("tv", "release_desc")).toBe("first_air_date.desc");
    expect(tmdbSortBy("tv", "title_az")).toBe("original_name.asc");
  });

  it("desconocido / null → default popularity.desc", () => {
    expect(tmdbSortBy("movie", "xyz")).toBe("popularity.desc");
    expect(tmdbSortBy("movie", null)).toBe("popularity.desc");
    expect(tmdbSortBy("tv", undefined)).toBe("popularity.desc");
  });
});

// ── year range ────────────────────────────────────────────────────────────────

describe("tmdbYearRange", () => {
  it("año exacto → rango de ese año", () => {
    expect(tmdbYearRange("2024")).toEqual({
      gte: "2024-01-01",
      lte: "2024-12-31",
    });
  });

  it("década → rango de 10 años (incluye 2020s)", () => {
    expect(tmdbYearRange("2020s")).toEqual({
      gte: "2020-01-01",
      lte: "2029-12-31",
    });
    expect(tmdbYearRange("2010s")).toEqual({
      gte: "2010-01-01",
      lte: "2019-12-31",
    });
  });

  it("classic → < 2000", () => {
    expect(tmdbYearRange("classic")).toEqual({
      gte: "1900-01-01",
      lte: "1999-12-31",
    });
  });

  it("vacío / inválido → null", () => {
    expect(tmdbYearRange(null)).toBeNull();
    expect(tmdbYearRange("")).toBeNull();
    expect(tmdbYearRange("abc")).toBeNull();
    expect(tmdbYearRange("20x0s")).toBeNull();
  });
});

// ── runtime range ───────────────────────────────────────────────────────────

describe("tmdbRuntimeRange", () => {
  it("buckets canónicos", () => {
    expect(tmdbRuntimeRange("short")).toEqual({ lte: "89" });
    expect(tmdbRuntimeRange("medium")).toEqual({ gte: "90", lte: "150" });
    expect(tmdbRuntimeRange("long")).toEqual({ gte: "151" });
  });

  it("desconocido → null", () => {
    expect(tmdbRuntimeRange("epic")).toBeNull();
    expect(tmdbRuntimeRange(null)).toBeNull();
  });
});

// ── buildTmdbDiscoverParams ─────────────────────────────────────────────────

describe("buildTmdbDiscoverParams — movie", () => {
  it("sin filtros → sort_by default + suelo de votos (E94)", () => {
    expect(buildTmdbDiscoverParams("movie")).toEqual({
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    });
  });

  it("suelo de votos vote_count.gte=50 siempre presente (E94)", () => {
    expect(
      buildTmdbDiscoverParams("movie")["vote_count.gte"]
    ).toBe("50");
    expect(
      buildTmdbDiscoverParams("movie", { genre: ["accion"] })["vote_count.gte"]
    ).toBe("50");
  });

  it("vote_count.gte convive con vote_average.gte sin pisarse (E94)", () => {
    const p = buildTmdbDiscoverParams("movie", { valoracion: "8" });
    expect(p["vote_count.gte"]).toBe("50");
    expect(p["vote_average.gte"]).toBe("8");
  });

  it("género único → with_genres con ID de la lista movie", () => {
    const p = buildTmdbDiscoverParams("movie", { genre: ["accion"] });
    expect(p.with_genres).toBe("28");
  });

  it("multi-género → OR con coma (orden preservado)", () => {
    const p = buildTmdbDiscoverParams("movie", {
      genre: ["accion", "comedia", "drama"],
    });
    expect(p.with_genres).toBe("28,35,18");
  });

  it("plataforma → with_watch_providers (OR |) + watch_region=ES", () => {
    const p = buildTmdbDiscoverParams("movie", {
      platform: ["netflix", "disney-plus"],
    });
    expect(p.with_watch_providers).toBe("8|337");
    expect(p.watch_region).toBe("ES");
  });

  it("idioma etiqueta → ISO; alias ISO también vale", () => {
    expect(
      buildTmdbDiscoverParams("movie", { idioma: "espanol" })
        .with_original_language
    ).toBe("es");
    expect(
      buildTmdbDiscoverParams("movie", { idioma: "ja" }).with_original_language
    ).toBe("ja");
  });

  it("década → primary_release_date.gte/lte", () => {
    const p = buildTmdbDiscoverParams("movie", { year: "2020s" });
    expect(p["primary_release_date.gte"]).toBe("2020-01-01");
    expect(p["primary_release_date.lte"]).toBe("2029-12-31");
  });

  it("duración → with_runtime.gte/lte", () => {
    const p = buildTmdbDiscoverParams("movie", { duracion: "medium" });
    expect(p["with_runtime.gte"]).toBe("90");
    expect(p["with_runtime.lte"]).toBe("150");
  });

  it("sort canónico → sort_by", () => {
    const p = buildTmdbDiscoverParams("movie", { sort: "rating" });
    expect(p.sort_by).toBe("vote_average.desc");
  });

  it("status NO se aplica a movie (oculto: TMDB no tiene with_status en movie)", () => {
    const p = buildTmdbDiscoverParams("movie", { status: "airing" });
    expect(p.with_status).toBeUndefined();
  });

  it("valoracion → vote_average.gte con el umbral (R4b nativo)", () => {
    expect(
      buildTmdbDiscoverParams("movie", { valoracion: "8" })["vote_average.gte"]
    ).toBe("8");
    expect(
      buildTmdbDiscoverParams("movie", { valoracion: "6" })["vote_average.gte"]
    ).toBe("6");
  });

  it("valoracion desconocida/vacía se ignora (sin vote_average.gte)", () => {
    expect(
      buildTmdbDiscoverParams("movie", { valoracion: "11" })["vote_average.gte"]
    ).toBeUndefined();
    expect(
      buildTmdbDiscoverParams("movie")["vote_average.gte"]
    ).toBeUndefined();
  });

  it("género desconocido se ignora (no rompe la query)", () => {
    const p = buildTmdbDiscoverParams("movie", {
      genre: ["accion", "inexistente"],
    });
    expect(p.with_genres).toBe("28");
  });

  it("todos los slugs desconocidos → sin with_genres", () => {
    const p = buildTmdbDiscoverParams("movie", { genre: ["nope", "zzz"] });
    expect(p.with_genres).toBeUndefined();
  });
});

describe("buildTmdbDiscoverParams — tv", () => {
  it("género usa la lista TV (acción-aventura combinada = 10759)", () => {
    const p = buildTmdbDiscoverParams("tv", { genre: ["accion-aventura"] });
    expect(p.with_genres).toBe("10759");
  });

  it("año → first_air_date.gte/lte (no primary_release_date)", () => {
    const p = buildTmdbDiscoverParams("tv", { year: "2024" });
    expect(p["first_air_date.gte"]).toBe("2024-01-01");
    expect(p["first_air_date.lte"]).toBe("2024-12-31");
    expect(p["primary_release_date.gte"]).toBeUndefined();
  });

  it("status → with_status con códigos (airing=0, complete=3|4)", () => {
    expect(
      buildTmdbDiscoverParams("tv", { status: "airing" }).with_status
    ).toBe("0");
    expect(
      buildTmdbDiscoverParams("tv", { status: "complete" }).with_status
    ).toBe("3|4");
  });

  it("duración NO se aplica a tv", () => {
    const p = buildTmdbDiscoverParams("tv", { duracion: "long" });
    expect(p["with_runtime.gte"]).toBeUndefined();
  });

  it("sort release usa first_air_date para tv", () => {
    expect(
      buildTmdbDiscoverParams("tv", { sort: "release_desc" }).sort_by
    ).toBe("first_air_date.desc");
  });

  it("valoracion → vote_average.gte (R4b nativo, también en tv)", () => {
    expect(
      buildTmdbDiscoverParams("tv", { valoracion: "7" })["vote_average.gte"]
    ).toBe("7");
  });

  it("temporadas NO entra en el builder nativo (es post-filtro R4c-2)", () => {
    const p = buildTmdbDiscoverParams("tv", { temporadas: "2-3" });
    expect(Object.keys(p).sort()).toEqual(["sort_by", "vote_count.gte"]);
  });

  it("suelo de votos vote_count.gte=50 también en tv (E94)", () => {
    expect(buildTmdbDiscoverParams("tv")["vote_count.gte"]).toBe("50");
    expect(
      buildTmdbDiscoverParams("tv", { genre: ["drama"] })["vote_count.gte"]
    ).toBe("50");
  });

  it("vote_count.gte convive con vote_average.gte en tv (E94)", () => {
    const p = buildTmdbDiscoverParams("tv", { valoracion: "7" });
    expect(p["vote_count.gte"]).toBe("50");
    expect(p["vote_average.gte"]).toBe("7");
  });
});

// ── filterTVByTemporadas (POST-filtro R4c-2) ─────────────────────────────────

describe("filterTVByTemporadas", () => {
  const items = [
    tv("a", 1),
    tv("b", 3),
    tv("c", 5),
    tv("d", 9),
    tv("e", undefined), // sin seasons → se descarta cuando hay bucket
  ];

  it("'1' → exactamente 1 temporada", () => {
    expect(filterTVByTemporadas(items, "1").map((i) => i.externalId)).toEqual([
      "a",
    ]);
  });

  it("'2-3' → 2..3 temporadas", () => {
    expect(filterTVByTemporadas(items, "2-3").map((i) => i.externalId)).toEqual([
      "b",
    ]);
  });

  it("'4-6' → 4..6 temporadas", () => {
    expect(filterTVByTemporadas(items, "4-6").map((i) => i.externalId)).toEqual([
      "c",
    ]);
  });

  it("'7plus' → 7+ temporadas", () => {
    expect(filterTVByTemporadas(items, "7plus").map((i) => i.externalId)).toEqual(
      ["d"]
    );
  });

  it("vacío/desconocido → no filtra (intactos)", () => {
    expect(filterTVByTemporadas(items, null)).toHaveLength(5);
    expect(filterTVByTemporadas(items, "zzz")).toHaveLength(5);
  });
});
