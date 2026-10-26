// ============================================================
// KULTURA — Sondas de `/api/health?deep=1` (COD-2)
// Ocho proveedores de catálogo que cuentan para `ok` y Wikidata (adaptaciones
// de la ficha) como sonda OPCIONAL: sale en el informe pero no tumba `ok` ni
// hace saltar el monitor. Una llamada barata y sin caché de datos cada uno, el
// resultado completo cacheado (para que la ruta no sirva para gastar cupo) y
// sin filtrar URLs ni claves en la respuesta.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "./cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import {
  DEEP_HEALTH_TTL_SECONDS,
  getProvidersReport,
  OPTIONAL_PROBES,
  PROBES,
  runProviderProbes,
} from "@/app/api/health/providers";
import { WIKIDATA_PROBE_TIMEOUT_MS } from "@/lib/api/wikidata";
import { resetProviderCircuits } from "@/lib/api/http";

/** Respuesta mínima válida para la sonda de cada proveedor, según la URL. */
function okFor(url: string): unknown {
  if (url.includes("themoviedb")) return { images: {} };
  if (url.includes("rawg")) return { results: [{}] };
  if (url.includes("anilist")) return { data: { Media: { id: 1 } } };
  if (url.includes("comicvine")) return { status_code: 1, results: [{}] };
  if (url.includes("mangadex")) return { data: [] };
  if (url.includes("openlibrary")) return { docs: [] };
  if (url.includes("googleapis")) return { totalItems: 0 };
  if (url.includes("steampowered")) return { "1145360": { success: true, data: {} } };
  if (url.includes("query.wikidata.org")) return { head: { vars: ["ok"] }, results: { bindings: [{ ok: { type: "literal", value: "1" } }] } };
  return {};
}

describe("sondas de proveedores", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ocho sondas que cuentan y Wikidata como opcional", () => {
    expect(OPTIONAL_PROBES.map(([p]) => p)).toEqual(["wikidata"]);
    expect(PROBES.map(([p]) => p)).toEqual([
      "tmdb",
      "rawg",
      "anilist",
      "comicvine",
      "mangadex",
      "openlibrary",
      "googlebooks",
      "steam",
    ]);
  });

  it("todo responde → ok:true y una llamada por proveedor", async () => {
    const fetchMock = vi.fn(async (url: string) => Response.json(okFor(url)));
    vi.stubGlobal("fetch", fetchMock);
    const report = await runProviderProbes();
    expect(report.ok).toBe(true);
    expect(Object.keys(report.providers)).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    for (const p of Object.values(report.providers)) {
      expect(p).toMatchObject({ ok: true, circuit: "closed" });
    }
  });

  it("un proveedor con 403 → ok:false, con tipo y status pero sin URL ni clave", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("anilist")
          ? Response.json({}, { status: 403 })
          : Response.json(okFor(url))
      )
    );
    const report = await runProviderProbes();
    expect(report.ok).toBe(false);
    expect(report.providers.anilist).toMatchObject({ ok: false, status: 403 });
    const text = JSON.stringify(report);
    expect(text).not.toContain("api_key");
    expect(text).not.toContain("https://");
  });

  it("Wikidata: una consulta SPARQL constante, sin datos de nadie y sin caché de datos", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      return Response.json(okFor(url));
    });
    vi.stubGlobal("fetch", fetchMock);
    const report = await runProviderProbes();
    expect(report.providers.wikidata).toMatchObject({ ok: true, circuit: "closed" });
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("query.wikidata.org"))!;
    const url = new URL(String(call[0]));
    expect(url.searchParams.get("format")).toBe("json");
    // Sin tripletas: Blazegraph no toca el grafo (la consulta más barata posible).
    expect(url.searchParams.get("query")).not.toMatch(/wdt:|wd:/);
    expect(call[1]?.cache).toBe("no-store");
  });

  it("Wikidata caída o con 429 → sale en el informe con su fallo, pero `ok` sigue true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("query.wikidata.org") ? Response.json({}, { status: 503 }) : Response.json(okFor(url))
      )
    );
    const report = await runProviderProbes();
    expect(report.ok).toBe(true);
    expect(report.providers.wikidata).toMatchObject({ ok: false, status: 503, optional: true });
    // Las que cuentan no llevan la marca.
    expect(report.providers.tmdb).not.toHaveProperty("optional");
  });

  it("Wikidata lenta: su sonda corta a los ~2,5 s (no a los 7 s de las fichas) y no tumba `ok`", async () => {
    expect(WIKIDATA_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(3000);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) =>
        url.includes("query.wikidata.org")
          ? new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            })
          : Promise.resolve(Response.json(okFor(url)))
      )
    );
    const startedAt = Date.now();
    const report = await runProviderProbes();
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeLessThan(WIKIDATA_PROBE_TIMEOUT_MS + 1500);
    expect(report.ok).toBe(true);
    expect(report.providers.wikidata).toMatchObject({ ok: false, optional: true });
  }, 10_000);

  it("el informe dura al menos 1 h (288 rondas al día se comían el cupo de RAWG)", () => {
    expect(DEEP_HEALTH_TTL_SECONDS).toBeGreaterThanOrEqual(3600);
  });

  it("el informe se cachea: la segunda consulta no vuelve a llamar a nadie", async () => {
    const fetchMock = vi.fn(async (url: string) => Response.json(okFor(url)));
    vi.stubGlobal("fetch", fetchMock);
    await getProvidersReport();
    await getProvidersReport();
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });
});
