// ============================================================
// KULTURA — Sondas de `/api/health?deep=1` (COD-2)
// Ocho proveedores, una llamada barata y sin caché de datos cada uno, el
// resultado completo cacheado (para que la ruta no sirva para gastar cupo) y
// sin filtrar URLs ni claves en la respuesta.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "./cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { getProvidersReport, PROBES, runProviderProbes } from "@/app/api/health/providers";
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
  return {};
}

describe("sondas de proveedores", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ocho entradas, una por proveedor de catálogo o ficha", () => {
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
    expect(Object.keys(report.providers)).toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledTimes(8);
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

  it("el informe se cachea: la segunda consulta no vuelve a llamar a nadie", async () => {
    const fetchMock = vi.fn(async (url: string) => Response.json(okFor(url)));
    vi.stubGlobal("fetch", fetchMock);
    await getProvidersReport();
    await getProvidersReport();
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
