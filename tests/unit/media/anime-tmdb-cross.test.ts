// ============================================================
// Fase 8.5 · F5c: cruce de un anime de AniList con TMDB por Wikidata.
//
// Sin red real: `fetch` responde con fixtures por host (AniList, WDQS, TMDB).
// Casos: película (El viaje de Chihiro, AniList 199 → TMDB 129), primera
// temporada (Frieren → serie 209867), temporada 2 (solo imagen), varios ids,
// año fuera de rango, tipo incoherente, y un 429 de WDQS con Retry-After.
// La caché: 30 días con cruce, 7 sin él; un fallo no se guarda.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Doble de `unstable_cache`: guarda lo que devuelve (con su plazo) y no lo que lanza. */
const cache = vi.hoisted(() => {
  const store = new Map<string, { value: unknown; revalidate: number }>();
  return {
    store,
    unstable_cache:
      <A extends unknown[], T>(fn: (...args: A) => Promise<T>, keyParts: string[], opts: { revalidate: number }) =>
      async (...args: A): Promise<T> => {
        const key = JSON.stringify([keyParts, args]);
        const hit = store.get(key);
        if (hit) return hit.value as T;
        const value = await fn(...args);
        store.set(key, { value, revalidate: opts.revalidate });
        return value;
      },
  };
});
vi.mock("next/cache", () => ({ unstable_cache: cache.unstable_cache }));

import {
  buildCrossQuery,
  crossScope,
  expectedKind,
  findAnimeTmdbCross,
  isLaterSeason,
  pickTmdbId,
  CROSS_HIT_REVALIDATE_SECONDS,
  CROSS_MISS_REVALIDATE_SECONDS,
} from "@/lib/media/anime-tmdb-cross";
import { providerCircuitState, resetProviderCircuits } from "@/lib/api/http";
import type { SparqlBinding } from "@/lib/api/wikidata";

// ── Fixtures ─────────────────────────────────────────────────────────────────

type Rel = { relationType: string; node: { id: number; type: string; format: string; startDate?: { year: number } } };
const ANILIST: Record<number, { idMal: number | null; format: string; seasonYear: number; relations: Rel[] }> = {
  199: { idMal: 199, format: "MOVIE", seasonYear: 2001, relations: [] },
  154587: {
    idMal: 52991,
    format: "TV",
    seasonYear: 2023,
    relations: [{ relationType: "SEQUEL", node: { id: 182255, type: "ANIME", format: "TV" } }],
  },
  182255: {
    idMal: 59978,
    format: "TV",
    seasonYear: 2026,
    relations: [
      { relationType: "PREQUEL", node: { id: 154587, type: "ANIME", format: "TV", startDate: { year: 2023 } } },
      { relationType: "SIDE_STORY", node: { id: 206425, type: "ANIME", format: "ONA", startDate: { year: 2026 } } },
    ],
  },
  // Varios ids de TMDB en Wikidata.
  500: { idMal: null, format: "TV", seasonYear: 2010, relations: [] },
  // TMDB dice 1995 y AniList 2005.
  600: { idMal: null, format: "MOVIE", seasonYear: 2005, relations: [] },
  // Película en AniList, pero Wikidata solo tiene un id de serie.
  700: { idMal: null, format: "MOVIE", seasonYear: 2015, relations: [] },
  // OVA: no se cruza.
  800: { idMal: null, format: "OVA", seasonYear: 2015, relations: [] },
};

const uri = (q: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${q}` });
const lit = (v: string) => ({ type: "literal", value: v });
const WIKIDATA: Record<string, SparqlBinding[]> = {
  "199": [{ seed: uri("Q155653"), tmdbMovie: lit("129") }],
  "154587": [{ seed: uri("Q130377145"), seriesTv: lit("209867") }],
  "182255": [{ seed: uri("Q130377146"), seriesTv: lit("209867") }],
  "500": [
    { seed: uri("Q1"), tmdbTv: lit("111") },
    { seed: uri("Q1"), tmdbTv: lit("222") },
  ],
  "600": [{ seed: uri("Q2"), tmdbMovie: lit("600") }],
  "700": [{ seed: uri("Q3"), tmdbTv: lit("700") }],
};

const TMDB: Record<string, unknown> = {
  "/3/movie/129": { id: 129, release_date: "2001-07-20" },
  "/3/tv/209867": {
    id: 209867,
    first_air_date: "2023-09-29",
    seasons: [
      { season_number: 0, air_date: "2024-01-01" },
      { season_number: 1, air_date: "2023-09-29" },
      { season_number: 2, air_date: "2026-01-16" },
    ],
  },
  "/3/movie/600": { id: 600, release_date: "1995-03-01" },
};

let wdqsStatus = 200;
let wdqsHeaders: Record<string, string> = {};

const calls = { anilist: 0, wikidata: 0, tmdb: 0 };

function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input);
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }));
  if (url.hostname === "graphql.anilist.co") {
    calls.anilist++;
    const { variables } = JSON.parse(String(init?.body)) as { variables: { id: number } };
    const m = ANILIST[variables.id];
    if (!m) return json({ data: { Media: null }, errors: [{ message: "Not Found.", status: 404 }] });
    return json({
      data: {
        Media: {
          id: variables.id,
          idMal: m.idMal,
          format: m.format,
          seasonYear: m.seasonYear,
          startDate: { year: m.seasonYear },
          relations: { edges: m.relations },
        },
      },
    });
  }
  if (url.hostname === "query.wikidata.org") {
    calls.wikidata++;
    if (wdqsStatus !== 200) return json({}, wdqsStatus, wdqsHeaders);
    const query = url.searchParams.get("query") ?? "";
    const al = /wdt:P8729 "(\d+)"/.exec(query)?.[1] ?? "";
    return json({ head: { vars: [] }, results: { bindings: WIKIDATA[al] ?? [] } });
  }
  if (url.hostname === "api.themoviedb.org") {
    calls.tmdb++;
    const body = TMDB[url.pathname];
    return body ? json(body) : json({ status_code: 34 }, 404);
  }
  return json({}, 503);
}

/** Lo que guarda el cruce (no las respuestas de cada proveedor, que tienen su propia caché). */
const crossEntries = () =>
  [...cache.store.entries()].filter(([k]) => k.includes("anime-tmdb-cross")).map(([, v]) => v);

beforeEach(() => {
  cache.store.clear();
  resetProviderCircuits();
  wdqsStatus = 200;
  wdqsHeaders = {};
  calls.anilist = calls.wikidata = calls.tmdb = 0;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── Piezas puras ─────────────────────────────────────────────────────────────

describe("piezas", () => {
  it("expectedKind: película o serie; el resto no se cruza", () => {
    expect(expectedKind("MOVIE")).toBe("movie");
    expect(expectedKind("TV")).toBe("tv");
    expect(expectedKind("TV_SHORT")).toBe("tv");
    expect(expectedKind("ONA")).toBe("tv");
    for (const f of ["OVA", "SPECIAL", "MUSIC", null, undefined]) expect(expectedKind(f)).toBeNull();
  });

  it("isLaterSeason: serie con una precuela que es serie", () => {
    const rel = (relationType: string, format: string, type = "ANIME") => ({ relationType, type, format, year: 2020 });
    expect(isLaterSeason({ format: "TV", relations: [rel("PREQUEL", "TV")] })).toBe(true);
    expect(isLaterSeason({ format: "ONA", relations: [rel("PREQUEL", "TV_SHORT")] })).toBe(true);
    expect(isLaterSeason({ format: "TV", relations: [rel("SEQUEL", "TV")] })).toBe(false);
    // Una película con precuela tiene su propia ficha en TMDB.
    expect(isLaterSeason({ format: "MOVIE", relations: [rel("PREQUEL", "TV")] })).toBe(false);
    // Precuela que es una película o un manga: no es «temporada 2».
    expect(isLaterSeason({ format: "TV", relations: [rel("PREQUEL", "MOVIE")] })).toBe(false);
    expect(isLaterSeason({ format: "TV", relations: [rel("PREQUEL", "MANGA", "MANGA")] })).toBe(false);
  });

  it("buildCrossQuery: por el id de AniList y el de MAL; ningún otro dato", () => {
    const q = buildCrossQuery(154587, 52991);
    expect(q).toContain('wdt:P8729 "154587"');
    expect(q).toContain('wdt:P4086 "52991"');
    expect(q).toContain("wdt:P4947");
    expect(q).toContain("wdt:P4983");
    expect(q).toContain("wdt:P179");
    expect(buildCrossQuery(1, null)).not.toContain("P4086");
    expect(() => buildCrossQuery(Number.NaN)).toThrow();
  });

  it("pickTmdbId: uno solo; varios o ninguno, nada; el propio manda sobre el de la serie", () => {
    expect(pickTmdbId(WIKIDATA["199"], "movie")).toBe(129);
    expect(pickTmdbId(WIKIDATA["199"], "tv")).toBeNull();
    expect(pickTmdbId(WIKIDATA["500"], "tv")).toBeNull();
    expect(pickTmdbId([], "tv")).toBeNull();
    expect(pickTmdbId([{ tmdbTv: lit("5") }, { seriesTv: lit("9") }], "tv")).toBe(5);
    expect(pickTmdbId([{ seriesTv: lit("9") }], "tv")).toBe(9);
    expect(pickTmdbId([{ tmdbMovie: lit("12a") }], "movie")).toBeNull();
  });

  it("crossScope: año a ±1; temporada posterior solo con su temporada en TMDB, y solo imagen", () => {
    expect(crossScope("movie", { release_date: "2001-07-20" }, 2002, false)).toBe("full");
    expect(crossScope("movie", { release_date: "2001-07-20" }, 2003, false)).toBeNull();
    expect(crossScope("movie", { release_date: "" }, 2001, false)).toBeNull();
    const frieren = TMDB["/3/tv/209867"] as { first_air_date: string; seasons: { season_number: number; air_date: string }[] };
    expect(crossScope("tv", frieren, 2023, false)).toBe("full");
    expect(crossScope("tv", frieren, 2026, true)).toBe("image");
    // «Primera temporada» de 2026 sobre una serie de 2023: no cuadra.
    expect(crossScope("tv", frieren, 2026, false)).toBeNull();
    // Temporada posterior sin temporada de TMDB en esa fecha.
    expect(crossScope("tv", frieren, 2030, true)).toBeNull();
    // TMDB aún sin la temporada nueva (Frieren en noviembre de 2026): vale el año de la precuela.
    const soloT1 = { first_air_date: "2023-09-29", seasons: [{ season_number: 1, air_date: "2023-09-29" }] };
    expect(crossScope("tv", soloT1, 2026, true)).toBeNull();
    expect(crossScope("tv", soloT1, 2026, true, [2023])).toBe("image");
    expect(crossScope("tv", soloT1, 2026, true, [2019])).toBeNull();
    expect(crossScope("tv", soloT1, 2026, false, [2023])).toBeNull();
    // Temporada posterior con su propia ficha en TMDB (estreno de ese año): todo.
    expect(crossScope("tv", { first_air_date: "2026-01-16" }, 2026, true)).toBe("full");
  });
});

// ── El cruce entero, con fixtures ────────────────────────────────────────────

describe("findAnimeTmdbCross", () => {
  it("El viaje de Chihiro (AniList 199) → película 129 de TMDB, todo", async () => {
    await expect(findAnimeTmdbCross(199)).resolves.toEqual({ kind: "movie", id: 129, scope: "full" });
  });

  it("Frieren, primera temporada → serie 209867, todo", async () => {
    await expect(findAnimeTmdbCross(154587)).resolves.toEqual({ kind: "tv", id: 209867, scope: "full" });
  });

  it("Frieren, temporada 2 → la misma serie, solo la imagen", async () => {
    await expect(findAnimeTmdbCross(182255)).resolves.toEqual({ kind: "tv", id: 209867, scope: "image" });
  });

  it("varios ids de TMDB: no se cruza (ni se pide TMDB)", async () => {
    await expect(findAnimeTmdbCross(500)).resolves.toBeNull();
    expect(calls.tmdb).toBe(0);
  });

  it("año fuera de rango: no se cruza", async () => {
    await expect(findAnimeTmdbCross(600)).resolves.toBeNull();
  });

  it("tipo incoherente (película con id de serie) y OVA: no se cruza", async () => {
    await expect(findAnimeTmdbCross(700)).resolves.toBeNull();
    await expect(findAnimeTmdbCross(800)).resolves.toBeNull();
    // La OVA ni siquiera llega a Wikidata.
    expect(calls.wikidata).toBe(1);
  });

  it("a Wikidata solo va el id público, con el User-Agent de KULTURA", async () => {
    await findAnimeTmdbCross(199);
    const wd = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes("query.wikidata.org"))!;
    const query = new URL(String(wd[0])).searchParams.get("query")!;
    expect(query).toContain('"199"');
    const headers = (wd[1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^KULTURA\/1\.0 \(\+https?:\/\/\S+; \S+\/es\/legal\)$/);
    expect(headers).not.toHaveProperty("Cookie");
  });

  it("caché: el cruce se guarda 30 días; sin cruce, 7; la segunda vez no sale a la red", async () => {
    await findAnimeTmdbCross(199);
    await findAnimeTmdbCross(500);
    const plazos = crossEntries().map((e) => e.revalidate).sort();
    expect(plazos).toEqual([CROSS_MISS_REVALIDATE_SECONDS, CROSS_HIT_REVALIDATE_SECONDS].sort());
    const before = { ...calls };
    await expect(findAnimeTmdbCross(199)).resolves.toMatchObject({ id: 129 });
    await expect(findAnimeTmdbCross(500)).resolves.toBeNull();
    expect(calls).toEqual(before);
  });

  it("429 de WDQS con Retry-After: sin cruce, sin guardar, y nadie vuelve a llamar hasta que pase el plazo", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    wdqsStatus = 429;
    wdqsHeaders = { "Retry-After": "120" };
    await expect(findAnimeTmdbCross(199)).resolves.toBeNull();
    expect(calls.wikidata).toBe(1);
    expect(crossEntries()).toEqual([]);
    expect(providerCircuitState("wikidata")).toBe("open");

    // Dentro del plazo: ni una petición más a WDQS.
    vi.setSystemTime(new Date("2026-11-24T10:01:59Z"));
    await expect(findAnimeTmdbCross(154587)).resolves.toBeNull();
    expect(calls.wikidata).toBe(1);

    // Pasado el plazo, una prueba; WDQS ya responde y el cruce sale.
    vi.setSystemTime(new Date("2026-11-24T10:02:01Z"));
    wdqsStatus = 200;
    await expect(findAnimeTmdbCross(199)).resolves.toMatchObject({ id: 129 });
    expect(calls.wikidata).toBe(2);
  });

  it("id imposible: nada, sin llamar a nadie", async () => {
    await expect(findAnimeTmdbCross(0)).resolves.toBeNull();
    await expect(findAnimeTmdbCross(Number.NaN)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
