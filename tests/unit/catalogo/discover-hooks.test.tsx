// KULTURA — Hooks de Descubrir por separado (F-32): la petición y los años.

import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// discover-config solo toma de la rejilla el patrón de celdas del esqueleto.
vi.mock("@/components/media/MediaGrid", () => ({ BENTO_CELL_CLASSES: ["cell"] }));
import { useDiscoverQuery } from "@/hooks/useDiscoverQuery";
import { buildYearBuckets } from "@/app/[locale]/(app)/discover/discover-config";

const base = { type: "movie", page: 1, filterQuery: "", query: "", locale: "es" };

function respond(body: unknown) {
  return Promise.resolve({ json: async () => body });
}

afterEach(() => vi.unstubAllGlobals());

describe("useDiscoverQuery", () => {
  it("monta la URL con filtros, búsqueda recortada e idioma", async () => {
    const fetchFn = vi.fn(() => respond({ items: [], fetchErrorKind: null }));
    vi.stubGlobal("fetch", fetchFn);
    renderHook(() => useDiscoverQuery({ ...base, filterQuery: "genre=28", query: "  dune ", page: 2 }));
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe(
      "/api/discover?genre=28&type=movie&page=2&q=dune&locale=es"
    );
  });

  it("totalPages null se conserva; ausente cae a 1; onSettled al terminar", async () => {
    const onSettled = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => respond({ items: [{ id: "a" }], totalPages: null, hasMore: true, fetchErrorKind: null })));
    const { result, rerender } = renderHook((p: typeof base) => useDiscoverQuery({ ...p, onSettled }), {
      initialProps: base,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ totalPages: null, hasMore: true, fetchErrorKind: null });
    expect(onSettled).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(() => respond({ items: [] })));
    rerender({ ...base, page: 2 });
    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(2));
    expect(result.current).toMatchObject({ totalPages: 1, hasMore: false, fetchErrorKind: null, items: [] });
  });

  it("fallo de red → error genérico; una respuesta vieja no pisa la nueva", async () => {
    let resolveOld: (v: unknown) => void = () => {};
    const fetchFn = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockImplementationOnce(() => Promise.reject(new Error("red")));
    vi.stubGlobal("fetch", fetchFn);
    const { result, rerender } = renderHook((p: typeof base) => useDiscoverQuery(p), { initialProps: base });
    rerender({ ...base, type: "tv" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fetchErrorKind).toBe("generic");
    await act(async () => {
      resolveOld({ json: async () => ({ items: [{ id: "old" }], fetchErrorKind: null }) });
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.fetchErrorKind).toBe("generic");
  });
});

describe("buildYearBuckets", () => {
  it("3 años, 2 décadas anteriores y clásicos", () => {
    expect(buildYearBuckets(2026).map((b) => b.value)).toEqual(["2026", "2025", "2024", "2010s", "2000s", "classic"]);
    expect(buildYearBuckets(2032).map((b) => b.value)).toEqual(["2032", "2031", "2030", "2020s", "2010s", "classic"]);
  });
});
