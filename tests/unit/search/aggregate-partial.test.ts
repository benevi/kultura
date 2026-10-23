// @vitest-environment node
// ============================================================
// KULTURA — type=all: respuesta parcial, relevancia y cupo de ComicVine (F-13)
//   - Si falla una familia, el agregado lo dice (`partial`) para que la ruta
//     devuelva `Cache-Control: no-store` (pendiente cruzado de F-06).
//   - En búsqueda, las familias se mezclan por relevancia.
//   - D-17: con ComicVine por encima del 80 % de su cupo, el cómic sale de
//     type=all (y sigue en su pestaña).
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult } from "@/lib/api/discover";

vi.mock("@/lib/api/discover", () => ({ fetchDiscoverData: vi.fn() }));
vi.mock("@/lib/api/search", () => ({ searchByTypePaged: vi.fn() }));

import { fetchDiscoverData } from "@/lib/api/discover";
import { searchByTypePaged } from "@/lib/api/search";
import {
  activeFamilies,
  fetchAggregateData,
  fetchAggregateResult,
  fetchAggregateSearch,
  FAMILIES,
} from "@/lib/api/aggregate";
import { _setProviderQuotaUsageForTests, resetProviderQuota } from "@/lib/api/http";

const item = (type: string, title: string, poster = "p"): MediaItem => ({
  id: `${type}_${title}`,
  externalId: title,
  type: type as MediaItem["type"],
  title,
  poster,
});

const ok = (items: MediaItem[]): DiscoverResult => ({ items, totalPages: 1, hasMore: false, fetchErrorKind: null });

beforeEach(() => {
  vi.clearAllMocks();
  resetProviderQuota();
});

describe("catálogo type=all: aviso de parcial", () => {
  it("todas las familias bien → partial false", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (type) => ok([item(type, `${type}-1`)]));
    const r = await fetchAggregateData(1);
    expect(r.partial).toBe(false);
    expect(r.items).toHaveLength(FAMILIES.length);
  });

  it("una familia con error del proveedor → partial true, el resto se sirve", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (type) =>
      type === "game"
        ? { items: [], totalPages: 1, hasMore: false, fetchErrorKind: "generic" }
        : ok([item(type, `${type}-1`)])
    );
    const r = await fetchAggregateData(1);
    expect(r.partial).toBe(true);
    expect(r.fetchErrorKind).toBeNull();
    expect(r.items).toHaveLength(FAMILIES.length - 1);
  });

  it("una familia que rechaza → partial true", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (type) => {
      if (type === "comic") throw new Error("boom");
      return ok([item(type, `${type}-1`)]);
    });
    expect((await fetchAggregateData(1)).partial).toBe(true);
  });
});

describe("búsqueda type=all", () => {
  it("mezcla por relevancia: las obras llamadas como la consulta primero", async () => {
    vi.mocked(searchByTypePaged).mockImplementation(async (_q, type) => {
      const lists: Record<string, MediaItem[]> = {
        movie: [item("movie", "Dune: Parte dos"), item("movie", "Dune")],
        book: [item("book", "Dune")],
        comic: [item("comic", "Dune: House Atreides")],
        game: [item("game", "Dune: Awakening")],
      };
      return { items: lists[type] ?? [], totalPages: 1, hasMore: false };
    });
    const r = await fetchAggregateSearch("dune", 1, "es");
    expect(r.items.slice(0, 2).map((i) => i.type).sort()).toEqual(["book", "movie"]);
    expect(r.partial).toBe(false);
  });

  it("una familia que falla → partial; todas → fetchErrorKind (no 'sin resultados')", async () => {
    vi.mocked(searchByTypePaged).mockImplementation(async (_q, type) => {
      if (type === "comic") throw Object.assign(new Error("cupo"), { status: 429 });
      return { items: [item(type, "x")], totalPages: 1, hasMore: false };
    });
    const partial = await fetchAggregateResult(1, {}, "es", "x");
    expect(partial.partial).toBe(true);
    expect(partial.fetchErrorKind).toBeNull();

    vi.mocked(searchByTypePaged).mockRejectedValue(Object.assign(new Error("cupo"), { status: 429 }));
    const all = await fetchAggregateResult(1, {}, "es", "x");
    expect(all.items).toEqual([]);
    expect(all.fetchErrorKind).toBe("rate-limit");

    vi.mocked(searchByTypePaged).mockRejectedValue(new Error("red"));
    expect((await fetchAggregateResult(1, {}, "es", "x")).fetchErrorKind).toBe("generic");
  });

  it("fetchAggregateResult aplica el filtro NSFW en búsqueda", async () => {
    vi.mocked(searchByTypePaged).mockImplementation(async (_q, type) => ({
      items: type === "movie" ? [item("movie", "Hentai Collection"), item("movie", "Akira")] : [],
      totalPages: 1,
      hasMore: false,
    }));
    const r = await fetchAggregateResult(1, {}, "es", "akira");
    expect(r.items.map((i) => i.title)).toEqual(["Akira"]);
  });

  it("sin consulta, fetchAggregateResult es el catálogo", async () => {
    vi.mocked(fetchDiscoverData).mockImplementation(async (type) => ok([item(type, `${type}-1`)]));
    const r = await fetchAggregateResult(1, {}, "es", null);
    expect(searchByTypePaged).not.toHaveBeenCalled();
    expect(r.items).toHaveLength(FAMILIES.length);
  });
});

describe("D-17: cómic fuera de type=all con el cupo de ComicVine al 80 %", () => {
  it("búsqueda: con /search/ al 80 % no se pregunta al cómic", async () => {
    _setProviderQuotaUsageForTests("comicvine", 160, "search");
    expect(activeFamilies("search")).not.toContain("comic");
    expect(activeFamilies("catalog")).toContain("comic");
    vi.mocked(searchByTypePaged).mockResolvedValue({ items: [], totalPages: 1, hasMore: false });
    await fetchAggregateSearch("batman", 1, "es");
    expect(vi.mocked(searchByTypePaged).mock.calls.map((c) => c[1])).not.toContain("comic");
  });

  it("catálogo: con /issues/ al 80 % el agregado no pide cómic", async () => {
    _setProviderQuotaUsageForTests("comicvine", 170, "issues");
    vi.mocked(fetchDiscoverData).mockImplementation(async (type) => ok([item(type, `${type}-1`)]));
    await fetchAggregateData(1);
    expect(vi.mocked(fetchDiscoverData).mock.calls.map((c) => c[0])).not.toContain("comic");
  });

  it("por debajo del 80 % el cómic sigue", () => {
    _setProviderQuotaUsageForTests("comicvine", 150, "search");
    expect(activeFamilies("search")).toContain("comic");
  });
});
