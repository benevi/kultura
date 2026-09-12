// ============================================================
// KULTURA — Matriz tipo×filtro permanente (E59 · R4d)
// Red data-driven que recorre TYPE_ORDER × TYPE_FILTERS (V2) y blinda lo cableado
// en R4a–R4c. Cuatro bloques:
//   1) Catálogo correcto por par (getFilterOptions usa el map del tipo, no otro).
//   2) Cableado por par: nativos → el builder emite el param real; post-filtros →
//      existe la fn y filtra (keep/drop con item mock).
//   3) Negativos política A: los 6 pares ocultos NO están en TYPE_FILTERS.
//   4) Bridges naming resueltos en parseDiscoverParams.
//
// Cualquier par recorrido sin catálogo o sin cableado que NO esté en los 6 ocultos
// es un agujero real → el test FALLA (no se silencia con skip).
// ============================================================

import { describe, it, expect } from "vitest";

import { TYPE_ORDER, TYPE_FILTERS } from "@/lib/discover/type-filters";
import type { DiscoverType } from "@/lib/discover/type-filters";
import { getFilterOptions } from "@/lib/discover/filter-options";

import {
  buildTmdbDiscoverParams,
  filterTVByTemporadas,
  TEMPORADAS_BUCKETS,
  TMDB_GENRE_MOVIE,
  TMDB_GENRE_TV,
  TMDB_PROVIDER,
  TMDB_DURACION,
} from "@/lib/api/tmdb-maps";
import {
  buildJikanDiscoverParams,
  filterByMinVolumes,
  VOLUMENES_MIN,
  JIKAN_GENRE,
  JIKAN_DEMOGRAPHIC,
  ANIME_STATUS,
  MANGA_STATUS,
} from "@/lib/api/jikan-maps";
import {
  buildRawgDiscoverParams,
  filterGamesByValoracion,
  filterGamesByEstado,
  filterGamesByModojuego,
  filterGamesByDuracionmedia,
  RAWG_GENRE,
  RAWG_PLATFORM,
  RAWG_MODOJUEGO_TAGS,
  DURACIONMEDIA_BUCKETS,
} from "@/lib/api/rawg-maps";
import {
  buildGoogleBooksQuery,
  BOOKS_GENRE,
  BOOKS_FORMATO,
  BOOKS_PUBLISHER,
} from "@/lib/api/books-maps";
import { COMIC_PUBLISHER } from "@/lib/api/comicvine-maps";
import { VALORACION_SLUGS } from "@/lib/api/valoracion";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import type { MediaItem } from "@/types/media";

// ── Helpers ──────────────────────────────────────────────────────────────────

const valuesOf = (type: DiscoverType, key: string) =>
  getFilterOptions(type, key).map((o) => o.value);

// `year` (buckets free-form relativos al año actual, inyectados por el UI) y `sort`
// (universal) NO tienen catálogo en getFilterOptions con value-table sensible:
// year → [] a propósito; sort → catálogo propio por tipo. Su CABLEADO sí se
// verifica (year en el bloque "anio", sort vía SORT_BY_TYPE). No son agujeros.
const NO_CATALOG_KEYS = new Set(["year"]);

function item(type: MediaItem["type"], metadata: Record<string, unknown>): MediaItem {
  return { id: `${type}_x`, externalId: "x", type, title: "x", metadata };
}

// Los 6 pares OCULTOS (política A). Fuente única para los bloques 1/2/3.
const HIDDEN_PAIRS = new Set([
  "valoracion@book",
  "valoracion@comic",
  "estado@book",
  "estado@comic",
  "temporadas@anime",
  "genre@comic",
]);

// ════════════════════════════════════════════════════════════════════════════
// 1) CATÁLOGO correcto por par
// ════════════════════════════════════════════════════════════════════════════

// Tabla esperada explícita por (key,type) para los pares SENSIBLES (los que un
// bug podría servir desde el map de otro tipo). El value catálogo = keys del map.
const EXPECTED_CATALOG: Record<string, Record<string, string[]>> = {
  editorial: {
    book: Object.keys(BOOKS_PUBLISHER),
    comic: Object.keys(COMIC_PUBLISHER),
  },
  genre: {
    book: Object.keys(BOOKS_GENRE),
    game: Object.keys(RAWG_GENRE),
    movie: Object.keys(TMDB_GENRE_MOVIE),
    tv: Object.keys(TMDB_GENRE_TV),
    anime: Object.keys(JIKAN_GENRE),
    manga: Object.keys(JIKAN_GENRE),
  },
  valoracion: {
    all: [...VALORACION_SLUGS],
    movie: [...VALORACION_SLUGS],
    tv: [...VALORACION_SLUGS],
    anime: [...VALORACION_SLUGS],
    manga: [...VALORACION_SLUGS],
    game: [...VALORACION_SLUGS],
  },
  temporadas: { tv: Object.keys(TEMPORADAS_BUCKETS) },
  volumenes: {
    manga: Object.keys(VOLUMENES_MIN),
    comic: Object.keys(VOLUMENES_MIN),
  },
  modojuego: { game: Object.keys(RAWG_MODOJUEGO_TAGS) },
  duracionmedia: { game: Object.keys(DURACIONMEDIA_BUCKETS) },
  platform: {
    game: Object.keys(RAWG_PLATFORM),
    movie: Object.keys(TMDB_PROVIDER),
    tv: Object.keys(TMDB_PROVIDER),
    all: Object.keys(TMDB_PROVIDER),
  },
  duracion: { movie: Object.keys(TMDB_DURACION) },
  demografia: {
    anime: Object.keys(JIKAN_DEMOGRAPHIC),
    manga: Object.keys(JIKAN_DEMOGRAPHIC),
  },
  status: {
    anime: Object.keys(ANIME_STATUS),
    manga: Object.keys(MANGA_STATUS),
  },
  formato: { book: Object.keys(BOOKS_FORMATO) },
};

describe("Matriz — catálogo correcto por par (tipo,filtro)", () => {
  for (const type of TYPE_ORDER) {
    for (const trig of TYPE_FILTERS[type]) {
      const key = trig.key;
      if (key === "sort") continue; // sort es universal y no tiene tabla sensible aquí.
      if (NO_CATALOG_KEYS.has(key)) continue; // year: buckets free-form (UI), sin catálogo.

      it(`${type} × ${key} → catálogo no vacío y values estables`, () => {
        const values = valuesOf(type, key);
        // Todo par visible debe producir opciones. Vacío = agujero real.
        expect(values.length).toBeGreaterThan(0);
        // values únicos y no vacíos.
        expect(new Set(values).size).toBe(values.length);
        for (const v of values) expect(v.length).toBeGreaterThan(0);

        // Si hay tabla esperada explícita para este par → debe casar EXACTO.
        const expected = EXPECTED_CATALOG[key]?.[type];
        if (expected) {
          expect(new Set(values)).toEqual(new Set(expected));
        }
      });
    }
  }

  // Anti-cruce explícito (los bugs que R4a tapó): editorial/genre nunca del otro map.
  it("editorial×book NO contiene editoriales de cómic (Marvel/DC/Image)", () => {
    const s = new Set(valuesOf("book", "editorial"));
    expect(s.has("marvel")).toBe(false);
    expect(s.has("dc")).toBe(false);
    expect(s.has("image")).toBe(false);
  });

  it("editorial×comic NO contiene editoriales de libro (Planeta/SM)", () => {
    const s = new Set(valuesOf("comic", "editorial"));
    expect(s.has("planeta")).toBe(false);
    expect(s.has("sm")).toBe(false);
    expect(s.has("marvel")).toBe(true);
  });

  it("genero×game (RAWG) ≠ genero×book (BOOKS)", () => {
    expect(new Set(valuesOf("game", "genre"))).not.toEqual(
      new Set(valuesOf("book", "genre"))
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2) CABLEADO por par
// ════════════════════════════════════════════════════════════════════════════

describe("Matriz — cableado nativo (builder emite param real)", () => {
  it("genero: tmdb→with_genres, jikan→genres, rawg→genres", () => {
    expect(
      buildTmdbDiscoverParams("movie", {
        genre: [valuesOf("movie", "genre")[0]],
      }).with_genres
    ).toBeDefined();
    expect(
      buildJikanDiscoverParams("anime", {
        genre: [valuesOf("anime", "genre")[0]],
      }).genres
    ).toBeDefined();
    expect(
      buildRawgDiscoverParams({ genre: [valuesOf("game", "genre")[0]] }).genres
    ).toBeDefined();
  });

  it("anio: tmdb movie→primary_release_date, tv→first_air_date, jikan→start_date, rawg→dates", () => {
    expect(
      buildTmdbDiscoverParams("movie", { year: "2024" })[
        "primary_release_date.gte"
      ]
    ).toBe("2024-01-01");
    expect(
      buildTmdbDiscoverParams("tv", { year: "2024" })["first_air_date.gte"]
    ).toBe("2024-01-01");
    expect(buildJikanDiscoverParams("anime", { year: "2024" }).start_date).toBe(
      "2024-01-01"
    );
    expect(buildRawgDiscoverParams({ year: "2024" }).dates).toBe(
      "2024-01-01,2024-12-31"
    );
  });

  it("valoracion nativo: tmdb→vote_average.gte, jikan→min_score", () => {
    const v = VALORACION_SLUGS[1]; // "8"
    expect(
      buildTmdbDiscoverParams("movie", { valoracion: v })["vote_average.gte"]
    ).toBe(v);
    expect(
      buildTmdbDiscoverParams("tv", { valoracion: v })["vote_average.gte"]
    ).toBe(v);
    expect(
      buildJikanDiscoverParams("anime", { valoracion: v }).min_score
    ).toBe(v);
    expect(
      buildJikanDiscoverParams("manga", { valoracion: v }).min_score
    ).toBe(v);
  });

  it("plataforma: tmdb→with_watch_providers, rawg→platforms", () => {
    expect(
      buildTmdbDiscoverParams("movie", {
        platform: [valuesOf("movie", "platform")[0]],
      }).with_watch_providers
    ).toBeDefined();
    expect(
      buildRawgDiscoverParams({ platform: [valuesOf("game", "platform")[0]] })
        .platforms
    ).toBeDefined();
  });

  // El trigger `idioma` se retiró de la UI de Descubrir (2026-09-12, a
  // petición del usuario): el catálogo ya sigue el locale activo de la app.
  // El builder conserva la capacidad de aceptar un override explícito (por
  // si algún caller server-side lo necesita) — se verifica directo, sin
  // pasar por `valuesOf` (que ya no tiene catálogo, al no ser visible).
  it("idioma (capacidad retenida en el builder, sin trigger de UI): tmdb→with_original_language", () => {
    expect(
      buildTmdbDiscoverParams("movie", { idioma: "es" }).with_original_language
    ).toBeDefined();
  });

  it("duracion (movie): tmdb→with_runtime.*", () => {
    const p = buildTmdbDiscoverParams("movie", { duracion: "medium" });
    expect(p["with_runtime.gte"] ?? p["with_runtime.lte"]).toBeDefined();
  });

  it("estado/status (tv): tmdb→with_status", () => {
    expect(
      buildTmdbDiscoverParams("tv", { status: valuesOf("tv", "status")[0] })
        .with_status
    ).toBeDefined();
  });

  it("demografia (anime/manga): jikan→genres (CSV de IDs)", () => {
    expect(
      buildJikanDiscoverParams("anime", {
        demografia: valuesOf("anime", "demografia")[0],
      }).genres
    ).toBeDefined();
  });

  // E-BOOKS-GOOGLE: formato pasa de fragmento en q (ebook_access de Open
  // Library) a `params.filter` nativo de Google Books.
  it("formato (book): buildGoogleBooksQuery→params.filter (free/ebook)", () => {
    expect(buildGoogleBooksQuery({ formato: "free" }).params.filter).toBe(
      "free-ebooks"
    );
    expect(buildGoogleBooksQuery({ formato: "ebook" }).params.filter).toBe(
      "ebooks"
    );
  });

  it("editorial (book): buildGoogleBooksQuery→q inpublisher: (nativo)", () => {
    expect(buildGoogleBooksQuery({ editorial: ["planeta"] }).q).toContain(
      'inpublisher:"Planeta"'
    );
  });
});

describe("Matriz — cableado post-filtros (fn existe y filtra keep/drop)", () => {
  it("valoracion×game → filtra por metacritic", () => {
    const items = [
      item("game", { metacritic: 90 }),
      item("game", { metacritic: 50 }),
    ];
    expect(filterGamesByValoracion(items, "8")).toHaveLength(1);
  });

  it("estado×game → filtra Early Access", () => {
    const items = [
      item("game", { tags: ["early-access"] }),
      item("game", { tags: ["multiplayer"] }),
    ];
    expect(filterGamesByEstado(items, "early-access")).toHaveLength(1);
    expect(filterGamesByEstado(items, "released")).toHaveLength(1);
  });

  it("modojuego×game → filtra por tag", () => {
    const items = [
      item("game", { tags: ["singleplayer"] }),
      item("game", { tags: ["multiplayer"] }),
    ];
    expect(filterGamesByModojuego(items, ["single"])).toHaveLength(1);
  });

  it("duracionmedia×game → normaliza playtime y filtra", () => {
    const items = [
      item("game", { playtime: 5 }),
      item("game", { playtime: 50 }),
    ];
    expect(filterGamesByDuracionmedia(items, "lt10")).toHaveLength(1);
  });

  it("temporadas×tv → filtra por seasons", () => {
    const items = [item("tv", { seasons: 1 }), item("tv", { seasons: 5 })];
    expect(filterTVByTemporadas(items, "1")).toHaveLength(1);
  });

  it("volumenes manga → filtra por metadata.volumes (bucket)", () => {
    const items = [
      item("manga", { volumes: 3 }),
      item("manga", { volumes: 30 }),
    ];
    expect(filterByMinVolumes(items, "6-20")).toHaveLength(1);
  });

  // volumenes×comic vive dentro de getRecentComics (no es una fn pura aislada);
  // su keep/drop por count_of_issues lo cubre tests/unit/api/comicvine.test.ts.
  // Aquí solo verificamos que el bucket compartido existe (VOLUMENES_MIN).
  it("volumenes comic → reusa VOLUMENES_MIN (bucket compartido con manga)", () => {
    expect(Object.keys(VOLUMENES_MIN).length).toBeGreaterThan(0);
    expect(valuesOf("comic", "volumenes")).toEqual(Object.keys(VOLUMENES_MIN));
  });
});

// Recorrido exhaustivo: TODO par visible debe tener catálogo (bloque 1) y, si
// es nativo o post conocido, cableado (bloques arriba). Este test detecta
// AGUJEROS: un par visible no contemplado por ninguna de las tablas anteriores.
describe("Matriz — sin agujeros (todo par visible está contemplado)", () => {
  // Filtros con catálogo + cableado verificado arriba (nativos o post).
  const WIRED_KEYS = new Set([
    "genre",
    "year",
    "valoracion",
    "platform",
    "idioma",
    "duracion",
    "status",
    "demografia",
    "formato",
    "temporadas",
    "volumenes",
    "editorial",
    "modojuego",
    "duracionmedia",
    "estado",
    "sort", // universal, cableado vía SORT_BY_TYPE en filter-options
  ]);

  for (const type of TYPE_ORDER) {
    for (const trig of TYPE_FILTERS[type]) {
      it(`${type} × ${trig.key} contemplado (catálogo + cableado)`, () => {
        const pair = `${trig.key}@${type}`;
        // Ningún par visible puede estar en los ocultos (contradicción).
        expect(HIDDEN_PAIRS.has(pair)).toBe(false);
        // Debe ser una key conocida (cableada). Si aparece una nueva → agujero.
        expect(WIRED_KEYS.has(trig.key)).toBe(true);
        // Y debe producir catálogo. Excepciones documentadas: sort (catálogo propio)
        // y year (buckets free-form del UI, sin catálogo). El cableado de ambos se
        // verifica en otros bloques.
        if (!NO_CATALOG_KEYS.has(trig.key)) {
          expect(getFilterOptions(type, trig.key).length).toBeGreaterThan(0);
        }
      });
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 3) NEGATIVOS política A — los 6 pares ocultos NO están en TYPE_FILTERS
// ════════════════════════════════════════════════════════════════════════════

describe("Política A — los 6 pares ocultos NO aparecen en TYPE_FILTERS", () => {
  const CASES: Array<[DiscoverType, string]> = [
    ["book", "valoracion"],
    ["comic", "valoracion"],
    ["book", "estado"],
    ["comic", "estado"],
    ["anime", "temporadas"],
    ["comic", "genre"],
  ];

  for (const [type, key] of CASES) {
    it(`${key}×${type} oculto`, () => {
      const keys = TYPE_FILTERS[type].map((t) => t.key);
      expect(keys).not.toContain(key);
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 4) BRIDGES naming en parseDiscoverParams
// ════════════════════════════════════════════════════════════════════════════

describe("Bridges naming (front paramKey → field canónico)", () => {
  const CASES: Array<{ param: string; field: keyof ReturnType<typeof parseDiscoverParams>; value: string; expected: unknown }> = [
    { param: "rating", field: "valoracion", value: "8", expected: "8" },
    { param: "seasons", field: "temporadas", value: "2-3", expected: "2-3" },
    { param: "gamemode", field: "modojuego", value: "single,coop", expected: ["single", "coop"] },
    { param: "playtime", field: "duracionmedia", value: "10-30", expected: "10-30" },
  ];

  for (const { param, field, value, expected } of CASES) {
    it(`${param} → ${String(field)}`, () => {
      const p = parseDiscoverParams(new URLSearchParams(`${param}=${value}`));
      expect(p[field]).toEqual(expected);
    });
  }

  // El paramKey de cada bridge en TYPE_FILTERS coincide con lo que parsea el route.
  it("los paramKey de TYPE_FILTERS casan con los bridges del parser", () => {
    const all = TYPE_ORDER.flatMap((t) => TYPE_FILTERS[t]);
    const byKey = (k: string) => all.find((t) => t.key === k)!;
    expect(byKey("valoracion").paramKey).toBe("rating");
    expect(byKey("temporadas").paramKey).toBe("seasons");
    expect(byKey("modojuego").paramKey).toBe("gamemode");
    expect(byKey("duracionmedia").paramKey).toBe("playtime");
  });
});
