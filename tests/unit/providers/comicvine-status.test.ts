// ============================================================
// KULTURA — ComicVine avisa de sus errores DENTRO del cuerpo (COD-B3)
//
// `status_code` 1 = OK; 100 = clave inválida; 107 = límite de peticiones.
// Antes nadie lo miraba: un 200 con `status_code: 107` y `results: []` se
// tomaba por "no hay cómics" y quedaba en caché una hora. Ahora es un error
// con el status HTTP equivalente y no se cachea.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "./cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { searchComics } from "@/lib/api/comicvine";
import { resetProviderCircuits } from "@/lib/api/http";

const body = (status_code: number, error: string) =>
  vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          status_code,
          error,
          number_of_total_results: 0,
          results: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );

describe("ComicVine status_code", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("107 (límite de peticiones) con HTTP 200 → error 429, no 'sin resultados'", async () => {
    vi.stubGlobal("fetch", body(107, "Rate limit exceeded"));
    await expect(searchComics("batman")).rejects.toMatchObject({ status: 429 });
  });

  it("100 (clave inválida) → error 401", async () => {
    vi.stubGlobal("fetch", body(100, "Invalid API Key"));
    await expect(searchComics("batman")).rejects.toMatchObject({ status: 401 });
  });

  it("el error no se cachea: la siguiente búsqueda vuelve a preguntar", async () => {
    const fetchMock = body(107, "Rate limit exceeded");
    vi.stubGlobal("fetch", fetchMock);
    await searchComics("batman").catch(() => {});
    await searchComics("batman").catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("status_code 1 con results vacío sí es 'sin resultados'", async () => {
    vi.stubGlobal("fetch", body(1, "OK"));
    await expect(searchComics("zzzz")).resolves.toMatchObject({ results: [] });
  });
});
