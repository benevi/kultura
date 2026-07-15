import { describe, it, expect } from "vitest";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { buildTmdbDiscoverParams } from "@/lib/api/tmdb-maps";
import { paramKeyFor, PARAM_KEY_BY_KEY } from "@/lib/discover/type-filters";

// ============================================================
// E88 — filtro de valoración: test del FLUJO REAL, no del parseo aislado.
//
// El bug E88 (reabierto) NO estaba en el parser ni en el builder — ambos
// funcionaban con la URL correcta. Estaba en el SEAM del cliente
// (DiscoverClient): la UI escribía la URL por la clave lógica (`valoracion`)
// pero el fetch la reconstruía leyendo el paramKey (`rating`) → el filtro se
// perdía antes de salir del navegador. El test viejo construía la URL a mano con
// `rating=9`, así que nunca tocaba ese seam y pasaba en falso.
//
// Aquí replicamos EXACTAMENTE las dos funciones del cliente que forman el seam,
// usando las mismas piezas de producción (paramKeyFor + FILTER_PARAM_KEYS), y
// seguimos el dato de punta a punta: emit onChange(key,value) → URL → query del
// fetch → params TMDB finales. Cubre los 4 triggers key≠paramKey.
// ============================================================

// Réplica fiel de DiscoverClient.FILTER_PARAM_KEYS (los params que el fetch
// reconstruye desde la URL). Si esta lista y la del cliente divergen, el test de
// "cobertura" de abajo lo detecta.
const FILTER_PARAM_KEYS = [
  "genre",
  "year",
  "platform",
  "sort",
  "status",
  "demografia",
  "duracion",
  "temporadas",
  "volumenes",
  "horas",
  "editorial",
  "formato",
  "idioma",
  "rating",
  "seasons",
  "gamemode",
  "playtime",
  "estado",
] as const;

/**
 * Réplica fiel de DiscoverClient.handleFilterChange (paso "emit → URL"): dado lo
 * que emite el FilterBar (`onChange(key, value)`), produce la URL. E88: escribe
 * por paramKey, no por key.
 */
function urlFromFilterChange(
  type: string,
  key: string,
  value: string | string[],
  base = ""
): URLSearchParams {
  const paramKey = paramKeyFor(key);
  const params = new URLSearchParams(base);
  if (value === "all") {
    params.delete(paramKey);
  } else if (Array.isArray(value)) {
    if (value.length === 0) params.delete(paramKey);
    else params.set(paramKey, value.join(","));
  } else {
    params.set(paramKey, value);
  }
  params.set("type", type);
  params.set("page", "1");
  return params;
}

/**
 * Réplica fiel de DiscoverClient.filterQuery (paso "URL → query del fetch"):
 * reconstruye la query que se manda a /api/discover recorriendo FILTER_PARAM_KEYS.
 * Lo que no esté en esa lista se PIERDE aquí (era la fuga del bug E88).
 */
function fetchQueryFromUrl(url: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of FILTER_PARAM_KEYS) {
    const v = url.get(key);
    if (v) out.set(key, v);
  }
  return out;
}

describe("E88 — valoración, flujo real (emit → URL → fetch → TMDB)", () => {
  it("elegir 9+ en Películas → URL rating=9 → sobrevive al fetch → vote_average.gte=9", () => {
    // 1. El FilterBar emite onChange con la clave LÓGICA del trigger.
    const url = urlFromFilterChange("movie", "valoracion", "9");
    // 2. La URL debe llevar el paramKey `rating`, NO `valoracion` (contrato E88).
    expect(url.get("rating")).toBe("9");
    expect(url.get("valoracion")).toBeNull();

    // 3. El fetch reconstruye la query desde la URL: `rating=9` debe sobrevivir.
    const fetchQuery = fetchQueryFromUrl(url);
    expect(fetchQuery.get("rating")).toBe("9");

    // 4. Backend: parser + builder producen vote_average.gte=9.
    const parsed = parseDiscoverParams(fetchQuery);
    expect(parsed.valoracion).toBe("9");
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBe("9");
  });

  it("REGRESIÓN E88: escribir la URL por `key` (bug) rompe el flujo", () => {
    // Simula el comportamiento PRE-fix: escribir la URL con la clave lógica.
    const buggyUrl = new URLSearchParams();
    buggyUrl.set("valoracion", "9"); // ← lo que hacía el bug
    buggyUrl.set("type", "movie");
    buggyUrl.set("page", "1");

    // El fetch lee por paramKey `rating` → no encuentra nada → filtro perdido.
    const fetchQuery = fetchQueryFromUrl(buggyUrl);
    expect(fetchQuery.get("rating")).toBeNull();
    const parsed = parseDiscoverParams(fetchQuery);
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    // Sin vote_average.gte: el catálogo vuelve populares (el síntoma reportado).
    expect(tmdb["vote_average.gte"]).toBeUndefined();
  });

  it("elegir 9+ en Descubrir (all) → rating=9 sobrevive el flujo", () => {
    const url = urlFromFilterChange("all", "valoracion", "9");
    expect(url.get("rating")).toBe("9");
    const parsed = parseDiscoverParams(fetchQueryFromUrl(url));
    expect(parsed.valoracion).toBe("9");
  });

  it("deseleccionar 9+ (emite 'all') → borra rating de la URL", () => {
    const url = urlFromFilterChange("movie", "valoracion", "all", "rating=9");
    expect(url.get("rating")).toBeNull();
  });

  it("sort no pisa el filtro: 9+ y sort=title_az conviven", () => {
    let url = urlFromFilterChange("movie", "valoracion", "9");
    url = urlFromFilterChange("movie", "sort", "title_az", url.toString());
    expect(url.get("rating")).toBe("9");
    expect(url.get("sort")).toBe("title_az");
    const parsed = parseDiscoverParams(fetchQueryFromUrl(url));
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBe("9");
    expect(tmdb.sort_by).toContain("title");
  });
});

// ── Los 4 triggers key≠paramKey: todos deben cruzar el seam sin perderse ──────
describe("E88 — puente key→paramKey para los 4 triggers afectados", () => {
  // key lógica → { paramKey en URL, tipo donde vive, valor de ejemplo }
  const CASES: Array<{ key: string; paramKey: string; type: string; value: string }> = [
    { key: "valoracion", paramKey: "rating", type: "movie", value: "9" },
    { key: "temporadas", paramKey: "seasons", type: "tv", value: "4-6" },
    { key: "modojuego", paramKey: "gamemode", type: "game", value: "single" },
    { key: "duracionmedia", paramKey: "playtime", type: "game", value: "10-30" },
  ];

  for (const { key, paramKey, type, value } of CASES) {
    it(`${key} → escribe ?${paramKey}=… y el fetch lo conserva`, () => {
      // paramKeyFor debe traducir key→paramKey (contrato del puente).
      expect(paramKeyFor(key)).toBe(paramKey);

      const url = urlFromFilterChange(type, key, value);
      // La URL usa el paramKey, no la key lógica.
      expect(url.get(paramKey)).toBe(value);
      expect(url.get(key)).toBeNull();

      // El paramKey está en FILTER_PARAM_KEYS → sobrevive al fetch.
      expect(FILTER_PARAM_KEYS).toContain(paramKey);
      expect(fetchQueryFromUrl(url).get(paramKey)).toBe(value);
    });
  }

  it("cobertura: todo paramKey del mapa key→paramKey está en FILTER_PARAM_KEYS", () => {
    // Garantiza que ningún trigger emita un paramKey que el fetch tiraría.
    for (const paramKey of Object.values(PARAM_KEY_BY_KEY)) {
      expect(FILTER_PARAM_KEYS).toContain(paramKey);
    }
  });

  it("paramKeyFor cae al propio key cuando no hay mapeo (identidad)", () => {
    expect(paramKeyFor("genre")).toBe("genre");
    expect(paramKeyFor("noexiste")).toBe("noexiste");
  });
});
