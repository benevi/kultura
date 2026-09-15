// ============================================================
// KULTURA — aggregate.ts unit tests (E59 R5a)
// Verifica merge + orden por sortKey, interleave popularity, parcial-ok
// (familia rechazada/vacía no rompe) y fetchErrorKind agregado por caso.
//
// Estrategia: mockeamos fetchDiscoverData (la rama por familia ya está testeada
// en discover.test.ts) para controlar lo que devuelve cada familia. Así el test
// se centra SOLO en la lógica de merge/orden/agregación de aggregate.ts.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult, FetchErrorKind } from "@/lib/api/discover";
import { DISCOVER_MAX_PAGES } from "@/lib/api/pagination";

vi.mock("@/lib/api/discover", () => ({
  fetchDiscoverData: vi.fn(),
}));

import { fetchDiscoverData } from "@/lib/api/discover";
import {
  fetchAggregateData,
  FAMILIES,
  PAGE_SIZE,
  PAGES_PER_ROUND,
  roundForPage,
  offsetInRound,
} from "@/lib/api/aggregate";

const mockFetch = vi.mocked(fetchDiscoverData);

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(
  type: string,
  id: string,
  extra: Partial<MediaItem> = {}
): MediaItem {
  return {
    id: `${type}_${id}`,
    externalId: id,
    type: type as MediaItem["type"],
    title: `${type}-${id}`,
    ...extra,
  };
}

function result(
  items: MediaItem[],
  fetchErrorKind: FetchErrorKind = null,
  hasMore = false
): DiscoverResult {
  // E79-s3: `hasMore` por familia SÍ importa ahora — indica si existe una ronda
  // nativa siguiente. Por defecto false (pool agotado) para que los tests de
  // merge/orden vean un total exacto.
  return { items, totalPages: 1, hasMore, fetchErrorKind };
}

/**
 * Configura el mock para devolver, por familia (en orden de FAMILIES), el
 * DiscoverResult del mapa. Familias ausentes → resultado vacío (ok).
 */
function setupByFamily(map: Partial<Record<string, DiscoverResult>>) {
  mockFetch.mockImplementation((type: string) =>
    Promise.resolve(map[type] ?? result([]))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fan-out ─────────────────────────────────────────────────────────────────

describe("fan-out", () => {
  it("llama fetchDiscoverData una vez por familia, con la página de la ronda", async () => {
    setupByFamily({});
    const filters = { sort: "popularity" };
    await fetchAggregateData(1, filters);

    expect(mockFetch).toHaveBeenCalledTimes(FAMILIES.length);
    for (const fam of FAMILIES) {
      expect(mockFetch).toHaveBeenCalledWith(fam, 1, filters, undefined);
    }
  });

  // E-TMDB-LOCALE: el locale del agregado se reenvía a cada familia.
  it("propaga el locale activo a cada familia", async () => {
    setupByFamily({});
    await fetchAggregateData(1, {}, "en");
    for (const fam of FAMILIES) {
      expect(mockFetch).toHaveBeenCalledWith(fam, 1, {}, "en");
    }
  });
});

// ── Orden por sortKey ─────────────────────────────────────────────────────────

describe("merge + orden", () => {
  it("rating: aplana y ordena desc por rating", async () => {
    setupByFamily({
      movie: result([item("movie", "1", { rating: 5 })]),
      tv: result([item("tv", "1", { rating: 9 })]),
      anime: result([item("anime", "1", { rating: 7 })]),
    });
    const { items } = await fetchAggregateData(1, { sort: "rating" });
    expect(items.map((i) => i.rating)).toEqual([9, 7, 5]);
  });

  it("rating: items sin rating tratados como 0 (al final)", async () => {
    setupByFamily({
      movie: result([item("movie", "1", { rating: 8 })]),
      tv: result([item("tv", "1", {})]), // sin rating
    });
    const { items } = await fetchAggregateData(1, { sort: "rating" });
    expect(items[0].rating).toBe(8);
    expect(items[1].rating).toBeUndefined();
  });

  it("recent: aplana y ordena desc por year", async () => {
    setupByFamily({
      movie: result([item("movie", "1", { year: 2010 })]),
      tv: result([item("tv", "1", { year: 2024 })]),
      anime: result([item("anime", "1", { year: 2018 })]),
    });
    const { items } = await fetchAggregateData(1, { sort: "recent" });
    expect(items.map((i) => i.year)).toEqual([2024, 2018, 2010]);
  });

  it("title_az: aplana y ordena por title con localeCompare 'es'", async () => {
    setupByFamily({
      movie: result([item("movie", "1", { title: "Ñandú" })]),
      tv: result([item("tv", "1", { title: "Avatar" })]),
      anime: result([item("anime", "1", { title: "Zelda" })]),
      book: result([item("book", "1", { title: "Naruto" })]),
    });
    const { items } = await fetchAggregateData(1, { sort: "title_az" });
    // 'es': N < Ñ < Z, Avatar primero.
    expect(items.map((i) => i.title)).toEqual([
      "Avatar",
      "Naruto",
      "Ñandú",
      "Zelda",
    ]);
  });
});

// ── Interleave popularity ─────────────────────────────────────────────────────

describe("popularity interleave", () => {
  it("round-robin entre familias en orden de FAMILIES, preservando orden nativo", async () => {
    setupByFamily({
      movie: result([item("movie", "1"), item("movie", "2")]),
      tv: result([item("tv", "1"), item("tv", "2")]),
      anime: result([item("anime", "1")]),
    });
    const { items } = await fetchAggregateData(1, { sort: "popularity" });
    // ronda 0: movie1, tv1, anime1 ; ronda 1: movie2, tv2 (anime agotado).
    expect(items.map((i) => i.id)).toEqual([
      "movie_1",
      "tv_1",
      "anime_1",
      "movie_2",
      "tv_2",
    ]);
  });

  it("sort ausente/desconocido → default popularity (interleave)", async () => {
    setupByFamily({
      movie: result([item("movie", "1")]),
      tv: result([item("tv", "1")]),
    });
    const { items: noSort } = await fetchAggregateData(1, {});
    const { items: bogus } = await fetchAggregateData(1, { sort: "xyz" });
    expect(noSort.map((i) => i.id)).toEqual(["movie_1", "tv_1"]);
    expect(bogus.map((i) => i.id)).toEqual(["movie_1", "tv_1"]);
  });
});

// ── Paginación (slice + totalPages) ───────────────────────────────────────────

describe("paginación", () => {
  it("slice de PAGE_SIZE sobre el pool global; totalPages = ceil(total/PAGE_SIZE)", async () => {
    // 1 familia con PAGE_SIZE + 5 items = 25 → 2 páginas, page2 con 5.
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) =>
      item("movie", String(i), { rating: 1000 - i })
    );
    setupByFamily({ movie: result(many) });

    const p1 = await fetchAggregateData(1, { sort: "rating" });
    const p2 = await fetchAggregateData(2, { sort: "rating" });

    expect(p1.items).toHaveLength(PAGE_SIZE);
    expect(p2.items).toHaveLength(5);
    expect(p1.totalPages).toBe(2);
    expect(p2.totalPages).toBe(2);
    // E79 slice 1: hasMore = page*PAGE_SIZE < pool. p1: 20<25 true; p2: 40>=25 false.
    expect(p1.hasMore).toBe(true);
    expect(p2.hasMore).toBe(false);
    // continuidad: último de p1 precede al primero de p2.
    expect(p1.items[PAGE_SIZE - 1].id).toBe(`movie_${PAGE_SIZE - 1}`);
    expect(p2.items[0].id).toBe(`movie_${PAGE_SIZE}`);
  });

  it("pool vacío → totalPages mínimo 1, items vacío", async () => {
    setupByFamily({});
    const { items, totalPages, hasMore } = await fetchAggregateData(1, {});
    expect(items).toEqual([]);
    expect(totalPages).toBe(1);
    expect(hasMore).toBe(false);
  });
});

// ── Profundidad por rondas (E79-s3) ───────────────────────────────────────────

describe("profundidad por rondas (E79-s3)", () => {
  it("roundForPage / offsetInRound: PAGES_PER_ROUND páginas por ronda", () => {
    expect(PAGES_PER_ROUND).toBeGreaterThan(1);
    // primera ronda
    expect(roundForPage(1)).toBe(1);
    expect(offsetInRound(1)).toBe(0);
    expect(roundForPage(PAGES_PER_ROUND)).toBe(1);
    expect(offsetInRound(PAGES_PER_ROUND)).toBe((PAGES_PER_ROUND - 1) * PAGE_SIZE);
    // segunda ronda arranca justo después
    expect(roundForPage(PAGES_PER_ROUND + 1)).toBe(2);
    expect(offsetInRound(PAGES_PER_ROUND + 1)).toBe(0);
    // página muy avanzada
    expect(roundForPage(PAGES_PER_ROUND * 5 + 1)).toBe(6);
  });

  it("la página global pide a cada familia la PÁGINA NATIVA de su ronda (antes: siempre 1)", async () => {
    setupByFamily({});
    await fetchAggregateData(PAGES_PER_ROUND + 1, {});
    for (const fam of FAMILIES) {
      expect(mockFetch).toHaveBeenCalledWith(fam, 2, {}, undefined);
    }
  });

  it("páginas de la misma ronda reusan la misma ronda nativa con offsets distintos", async () => {
    const many = Array.from({ length: PAGE_SIZE * PAGES_PER_ROUND }, (_, i) =>
      item("movie", String(i), { rating: 10_000 - i })
    );
    setupByFamily({ movie: result(many) });

    const first = await fetchAggregateData(1, { sort: "rating" });
    const second = await fetchAggregateData(2, { sort: "rating" });

    expect(mockFetch).toHaveBeenCalledWith("movie", 1, { sort: "rating" }, undefined);
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(second.items).toHaveLength(PAGE_SIZE);
    // sin solapamiento: la página 2 sigue justo donde acabó la 1.
    expect(second.items[0].id).toBe(`movie_${PAGE_SIZE}`);
  });

  it("si alguna familia tiene más páginas nativas → hasMore true y totalPages null (ventana abierta)", async () => {
    setupByFamily({
      movie: result([item("movie", "1")], null, true), // hasMore de la familia
    });
    const { hasMore, totalPages } = await fetchAggregateData(1, {});
    expect(hasMore).toBe(true);
    // No se puede conocer el total sin recorrerlo → null (patrón E79-s2).
    expect(totalPages).toBeNull();
  });

  it("pool agotado en todas las familias → totalPages exacto contando rondas anteriores", async () => {
    setupByFamily({ movie: result([item("movie", "1")], null, false) });
    const r2 = await fetchAggregateData(PAGES_PER_ROUND + 1, {});
    // 1 ronda entera atrás + 1 página que llena ésta.
    expect(r2.totalPages).toBe(PAGES_PER_ROUND + 1);
    expect(r2.hasMore).toBe(false);
  });

  it("respeta el tope común: en la última página no ofrece siguiente", async () => {
    setupByFamily({
      movie: result([item("movie", "1")], null, true),
    });
    const last = await fetchAggregateData(DISCOVER_MAX_PAGES, {});
    expect(last.hasMore).toBe(false);
  });

  it("página global fuera del tope → vacío sin error y SIN llamar a las familias", async () => {
    // El guard de `fetchDiscoverData` mira la página NATIVA (la de la ronda),
    // que aquí seguiría siendo baja → el agregado necesita su propio guard.
    setupByFamily({ movie: result([item("movie", "1")], null, true) });
    const out = await fetchAggregateData(DISCOVER_MAX_PAGES + 1, {});
    expect(out.items).toEqual([]);
    expect(out.hasMore).toBe(false);
    expect(out.totalPages).toBe(DISCOVER_MAX_PAGES);
    expect(out.fetchErrorKind).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Parcial-ok ────────────────────────────────────────────────────────────────

describe("parcial-ok", () => {
  it("familia que rechaza (allSettled rejected) no rompe el agregado", async () => {
    mockFetch.mockImplementation((type: string) => {
      if (type === "game") return Promise.reject(new Error("boom"));
      if (type === "movie") return Promise.resolve(result([item("movie", "1")]));
      return Promise.resolve(result([]));
    });
    const { items, fetchErrorKind } = await fetchAggregateData(1, {});
    expect(items.map((i) => i.id)).toEqual(["movie_1"]);
    expect(fetchErrorKind).toBeNull();
  });

  it("familia vacía no aporta items ni rompe", async () => {
    setupByFamily({
      movie: result([]),
      tv: result([item("tv", "1")]),
    });
    const { items } = await fetchAggregateData(1, { sort: "popularity" });
    expect(items.map((i) => i.id)).toEqual(["tv_1"]);
  });
});

// ── fetchErrorKind agregado ───────────────────────────────────────────────────

describe("fetchErrorKind agregado", () => {
  it("≥1 familia con items → null (aunque otra esté rate-limit)", async () => {
    setupByFamily({
      movie: result([item("movie", "1")]),
      anime: result([], "rate-limit"),
    });
    const { fetchErrorKind } = await fetchAggregateData(1, {});
    expect(fetchErrorKind).toBeNull();
  });

  it("0 items y alguna familia rate-limit → 'rate-limit'", async () => {
    setupByFamily({
      anime: result([], "rate-limit"),
      manga: result([], "generic"),
    });
    const { fetchErrorKind } = await fetchAggregateData(1, {});
    expect(fetchErrorKind).toBe("rate-limit");
  });

  it("0 items, sin rate-limit → 'generic'", async () => {
    setupByFamily({
      movie: result([], "generic"),
      tv: result([], null),
    });
    const { fetchErrorKind } = await fetchAggregateData(1, {});
    expect(fetchErrorKind).toBe("generic");
  });
});
