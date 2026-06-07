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
  filterGamesByValoracion,
  filterGamesByEstado,
  filterGamesByModojuego,
  filterGamesByDuracionmedia,
  playtimeBucket,
  applyGamePostFilters,
} from "@/lib/api/rawg-maps";
import type { MediaItem } from "@/types/media";

// Helper: MediaItem game mínimo con metadata controlable para los post-filtros.
function game(
  id: string,
  metadata: Record<string, unknown>
): MediaItem {
  return {
    id: `game_${id}`,
    externalId: id,
    type: "game",
    title: id,
    metadata,
  };
}

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

  it("post-filtros (modojuego/estado/duracionmedia) NO entran en el builder nativo", () => {
    const p = buildRawgDiscoverParams({
      genre: ["accion"],
      modojuego: ["single"],
      estado: "early-access",
      duracionmedia: "lt10",
      valoracion: "8",
    });
    expect(Object.keys(p).sort()).toEqual(["genres", "ordering"]);
  });
});

// ── POST-filtros game (R4c-1) ────────────────────────────────────────────────

describe("filterGamesByValoracion (metacritic)", () => {
  const items = [
    game("a", { metacritic: 90 }),
    game("b", { metacritic: 75 }),
    game("c", {}), // sin metacritic → se descarta cuando hay umbral
  ];

  it("valoracion=8 → metacritic >= 80 (keep a, drop b/c)", () => {
    const out = filterGamesByValoracion(items, "8");
    expect(out.map((i) => i.externalId)).toEqual(["a"]);
  });

  it("vacío/desconocido → no filtra (intactos)", () => {
    expect(filterGamesByValoracion(items, null)).toHaveLength(3);
    expect(filterGamesByValoracion(items, "99")).toHaveLength(3);
  });
});

describe("filterGamesByEstado (early-access tag)", () => {
  const items = [
    game("ea", { tags: ["singleplayer", "early-access"] }),
    game("rel", { tags: ["multiplayer"] }),
  ];

  it("early-access → solo items con el tag", () => {
    expect(
      filterGamesByEstado(items, "early-access").map((i) => i.externalId)
    ).toEqual(["ea"]);
  });

  it("released → items SIN el tag", () => {
    expect(
      filterGamesByEstado(items, "released").map((i) => i.externalId)
    ).toEqual(["rel"]);
  });

  it("desconocido → no filtra", () => {
    expect(filterGamesByEstado(items, "xyz")).toHaveLength(2);
  });
});

describe("filterGamesByModojuego (tags)", () => {
  const items = [
    game("sp", { tags: ["singleplayer"] }),
    game("mp", { tags: ["multiplayer"] }),
    game("coop", { tags: ["co-op"] }),
    game("none", { tags: [] }),
  ];

  it("single → solo singleplayer", () => {
    expect(
      filterGamesByModojuego(items, ["single"]).map((i) => i.externalId)
    ).toEqual(["sp"]);
  });

  it("multi-select → unión (single+coop)", () => {
    expect(
      filterGamesByModojuego(items, ["single", "coop"])
        .map((i) => i.externalId)
        .sort()
    ).toEqual(["coop", "sp"]);
  });

  it("vacío/desconocido → no filtra", () => {
    expect(filterGamesByModojuego(items, [])).toHaveLength(4);
    expect(filterGamesByModojuego(items, ["nope"])).toHaveLength(4);
  });
});

describe("playtimeBucket (normalización horas → bucket)", () => {
  it("normaliza a bucket correcto por rango", () => {
    expect(playtimeBucket(5)).toBe("lt10");
    expect(playtimeBucket(9)).toBe("lt10");
    expect(playtimeBucket(10)).toBe("10-30");
    expect(playtimeBucket(30)).toBe("10-30");
    expect(playtimeBucket(45)).toBe("30-60");
    expect(playtimeBucket(60)).toBe("30-60");
    expect(playtimeBucket(120)).toBe("60plus");
  });

  it("inválido → null", () => {
    expect(playtimeBucket(undefined)).toBeNull();
    expect(playtimeBucket(-5)).toBeNull();
    expect(playtimeBucket(NaN)).toBeNull();
  });
});

describe("filterGamesByDuracionmedia (playtime → bucket)", () => {
  const items = [
    game("short", { playtime: 5 }),
    game("mid", { playtime: 20 }),
    game("long", { playtime: 100 }),
    game("none", {}), // sin playtime → descartado al filtrar
  ];

  it("10-30 → solo mid", () => {
    expect(
      filterGamesByDuracionmedia(items, "10-30").map((i) => i.externalId)
    ).toEqual(["mid"]);
  });

  it("60plus → solo long", () => {
    expect(
      filterGamesByDuracionmedia(items, "60plus").map((i) => i.externalId)
    ).toEqual(["long"]);
  });

  it("vacío/desconocido → no filtra", () => {
    expect(filterGamesByDuracionmedia(items, null)).toHaveLength(4);
    expect(filterGamesByDuracionmedia(items, "zzz")).toHaveLength(4);
  });
});

describe("applyGamePostFilters (cadena AND)", () => {
  it("combina los 4 post-filtros", () => {
    const items = [
      // keep: metacritic>=80, early-access, singleplayer, 10-30h
      game("keep", {
        metacritic: 85,
        tags: ["early-access", "singleplayer"],
        playtime: 20,
      }),
      // drop: metacritic bajo
      game("lowscore", {
        metacritic: 50,
        tags: ["early-access", "singleplayer"],
        playtime: 20,
      }),
      // drop: no early-access
      game("released", {
        metacritic: 90,
        tags: ["singleplayer"],
        playtime: 20,
      }),
    ];
    const out = applyGamePostFilters(items, {
      valoracion: "8",
      estado: "early-access",
      modojuego: ["single"],
      duracionmedia: "10-30",
    });
    expect(out.map((i) => i.externalId)).toEqual(["keep"]);
  });

  it("sin post-filtros → intactos", () => {
    const items = [game("a", { metacritic: 10 })];
    expect(applyGamePostFilters(items, {})).toHaveLength(1);
  });
});
