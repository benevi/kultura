import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Caché de datos simulada: misma clave (argumentos) → mismo valor, como `unstable_cache`.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => Promise<unknown>) => {
    const memo = new Map<string, unknown>();
    return async (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, await fn(...args));
      return memo.get(key);
    };
  },
}));
vi.mock("@/lib/best/best-of", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/best/best-of")>();
  return { ...real, getBestSelection: vi.fn() };
});
const supabase = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => supabase);
vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://sb.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" },
}));

import {
  COLLECTION_MIN_TITLES,
  IN_BATCH,
  MAX_PUBLIC_LISTS,
  PAGE_SIZE,
  collectionsFromRows,
  collectionsSitemap,
  loadRankings,
  pagesSitemap,
  rankingsSitemap,
  sectionSitemap,
  titlesSitemap,
  type RankingSnapshot,
} from "@/lib/best/sitemap";
import { BEST_FORMATS, getBestSelection, type BestSelection } from "@/lib/best/best-of";
import type { BestSource } from "@/lib/best/localize";

const source = (type: string, externalId: string): BestSource => ({
  id: `${type}_${externalId}`,
  externalId,
  type: type as BestSource["type"],
  title: `T ${externalId}`,
  poster: "https://image.tmdb.org/t/p/w500/x.jpg",
  genres: [],
});

const selection = (type: string, n: number, updatedAt = "2026-10-20T03:00:00.000Z", offset = 0): BestSelection => ({
  items: Array.from({ length: n }, (_, i) => source(type, String(offset + i))),
  updatedAt,
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app");
  vi.mocked(getBestSelection).mockReset();
  supabase.createClient.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("sitemap — páginas fijas", () => {
  it("sin /login y con hreflang de los dos idiomas", () => {
    const entries = pagesSitemap();
    expect(entries.map((e) => e.url)).not.toContain("https://x.app/es/login");
    expect(entries.some((e) => e.url.includes("/login"))).toBe(false);
    expect(entries[0].alternates?.languages).toEqual({ es: "https://x.app/es", en: "https://x.app/en" });
    // Sin fecha real (no se inventa `lastModified`).
    expect(entries.every((e) => e.lastModified === undefined)).toBe(true);
  });
});

describe("sitemap — rankings y hubs (D-16)", () => {
  const snapshots: RankingSnapshot[] = [
    { format: "anime", year: 2026, selection: selection("anime", 20), changedAt: "2026-10-22T05:00:00.000Z" },
    { format: "anime", year: 2025, selection: selection("anime", 20, undefined, 100), changedAt: "2026-03-01T05:00:00.000Z" },
    { format: "movie", year: 2026, selection: selection("movie", 5), changedAt: "2026-10-23T00:00:00.000Z" }, // corta → noindex
    { format: "game", year: 2026, selection: null }, // proveedor caído
  ];

  it("hubs siempre; rankings solo los indexables, fechados el día en que cambió su lista", () => {
    const urls = rankingsSitemap(snapshots).map((e) => e.url);
    expect(urls).toContain("https://x.app/es/best");
    for (const f of BEST_FORMATS) expect(urls).toContain(`https://x.app/en/best/${f}`);
    expect(urls).toContain("https://x.app/es/best/anime/2026");
    expect(urls).not.toContain("https://x.app/es/best/movie/2026");
    expect(urls).not.toContain("https://x.app/es/best/game/2026");
    const anime = rankingsSitemap(snapshots).find((e) => e.url === "https://x.app/es/best/anime/2025");
    expect(anime?.lastModified).toBe("2026-03-01T05:00:00.000Z");
    const hub = rankingsSitemap(snapshots).find((e) => e.url === "https://x.app/es/best/anime");
    expect(hub?.lastModified).toBe("2026-10-22T05:00:00.000Z");
    // Un ranking corto no fecha el hub.
    expect(rankingsSitemap(snapshots).find((e) => e.url === "https://x.app/es/best/movie")?.lastModified).toBeUndefined();
  });

  it("la fecha de un ranking NO cambia con el recálculo diario si la lista es la misma", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-20T03:00:00Z"));
      vi.mocked(getBestSelection).mockImplementation(async (format, year) =>
        selection(format, 20, new Date().toISOString(), year * 10),
      );
      const day1 = await loadRankings(new Date("2026-10-23"));
      vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
      const day2 = await loadRankings(new Date("2026-10-23"));
      expect(day2.map((s) => s.changedAt)).toEqual(day1.map((s) => s.changedAt));
      expect(day1[0].changedAt).toBe("2026-10-20T03:00:00.000Z");
      // Cambia un título del anime de 2026 → nueva fecha solo para ese ranking.
      vi.setSystemTime(new Date("2026-10-22T03:00:00Z"));
      vi.mocked(getBestSelection).mockImplementation(async (format, year) =>
        selection(format, 20, new Date().toISOString(), format === "anime" && year === 2026 ? 1 : year * 10),
      );
      const day3 = await loadRankings(new Date("2026-10-23"));
      expect(day3[0]).toMatchObject({ format: "anime", year: 2026, changedAt: "2026-10-22T03:00:00.000Z" });
      expect(day3[1].changedAt).toBe("2026-10-20T03:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fichas: los títulos de los rankings indexables, sin repetir, sin lastModified", () => {
    const dup: RankingSnapshot[] = [
      ...snapshots,
      { format: "anime", year: 2024, selection: selection("anime", 10) },
    ];
    const entries = titlesSitemap(dup);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://x.app/es/media/anime/0");
    expect(urls).toContain("https://x.app/en/media/anime/100");
    expect(urls.some((u) => u.includes("/media/movie/"))).toBe(false); // ranking corto
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.every((e) => e.lastModified === undefined)).toBe(true);
  });

  it("con los 12 rankings llenos el sitemap suma ≥ 300 URL (aceptación de F-16)", async () => {
    let n = 0;
    vi.mocked(getBestSelection).mockImplementation(async (format) => selection(format, 20, undefined, (n++) * 20));
    const snaps = await loadRankings(new Date("2026-10-23"));
    expect(snaps).toHaveLength(12);
    const total = pagesSitemap().length + rankingsSitemap(snaps).length + titlesSitemap(snaps).length;
    expect(total).toBeGreaterThanOrEqual(300);
  });

  it("un ranking que lanza no tumba la sección: se queda fuera", async () => {
    vi.mocked(getBestSelection).mockRejectedValue(new Error("caído"));
    const urls = (await sectionSitemap("rankings")).map((e) => e.url);
    expect(urls.some((u) => /\/best\/\w+\/\d{4}$/.test(u))).toBe(false);
    expect(urls).toContain("https://x.app/es/best");
  });

  it("una sección desconocida está vacía", async () => {
    expect(await sectionSitemap("nada")).toEqual([]);
  });
});

describe("sitemap — perfiles y listas públicos", () => {
  const lists = [
    { id: "l1", owner_id: "u1", created_at: "2026-09-01T00:00:00Z" },
    { id: "l2", owner_id: "u1", created_at: "2026-09-02T00:00:00Z" },
    { id: "l3", owner_id: "u2", created_at: "2026-09-03T00:00:00Z" },
  ];
  const items = [
    ...Array.from({ length: COLLECTION_MIN_TITLES }, (_, i) => ({ list_id: "l1", added_at: `2026-10-0${i + 1}T00:00:00Z` })),
    { list_id: "l2", added_at: "2026-10-09T00:00:00Z" },
    { list_id: "l3", added_at: "2026-10-01T00:00:00Z" },
  ];
  const owners = [
    { id: "u1", username: "benevi" },
    { id: "u2", username: "ana" },
  ];

  it("perfil con ≥ 5 títulos públicos y listas con ≥ 5; el resto fuera", () => {
    const entries = collectionsFromRows(lists, items, owners);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://x.app/es/u/benevi");
    expect(urls).toContain("https://x.app/es/u/benevi/l/l1");
    expect(urls).not.toContain("https://x.app/es/u/benevi/l/l2");
    expect(urls.some((u) => u.includes("/u/ana"))).toBe(false);
    expect(entries.find((e) => e.url === "https://x.app/es/u/benevi")?.lastModified).toBe("2026-10-09T00:00:00Z");
  });

  it("lee con la clave anónima (lo que ve un visitante) y sin Supabase devuelve []", async () => {
    supabase.createClient.mockImplementation(() => {
      throw new Error("sin red");
    });
    expect(await collectionsSitemap()).toEqual([]);
  });

  /** Supabase simulado: tablas en memoria con select/eq/in/order/range. */
  function fakeSupabase(tables: Record<string, Array<Record<string, unknown>>>) {
    const calls = { inSizes: [] as number[], ranges: [] as Array<[string, number, number]>, eq: [] as unknown[][] };
    const from = (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => {
          calls.eq.push([col, v]);
          rows = rows.filter((r) => r[col] === v);
          return q;
        },
        in: (col: string, vs: unknown[]) => {
          calls.inSizes.push(vs.length);
          rows = rows.filter((r) => vs.includes(r[col]));
          return q;
        },
        order: () => q,
        range: async (a: number, b: number) => {
          calls.ranges.push([table, a, b]);
          // PostgREST rechaza un rango vacío o invertido (416).
          if (a > b) return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } };
          // PostgREST: como mucho PAGE_SIZE filas aunque se pidan más.
          return { data: rows.slice(a, Math.min(b + 1, a + PAGE_SIZE)), error: null };
        },
      };
      return q;
    };
    supabase.createClient.mockReturnValue({ from });
    return calls;
  }

  it("consulta solo listas públicas, con la clave anónima", async () => {
    const calls = fakeSupabase({ lists: [] });
    expect(await collectionsSitemap()).toEqual([]);
    expect(calls.eq).toContainEqual(["is_public", true]);
    expect(supabase.createClient).toHaveBeenCalledWith("https://sb.example", "anon", expect.anything());
  });

  it("2001 listas o más: se leen las primeras 2000, sin pedir un rango inválido", async () => {
    const n = MAX_PUBLIC_LISTS + 5;
    const lists = Array.from({ length: n }, (_, i) => ({ id: `l${i}`, owner_id: "u0", created_at: "2026-09-01T00:00:00Z", is_public: true }));
    const items = lists.flatMap((l) => Array.from({ length: 5 }, () => ({ list_id: l.id, added_at: "2026-10-01T00:00:00Z" })));
    const calls = fakeSupabase({ lists, list_items: items, users: [{ id: "u0", username: "benevi" }] });
    const entries = await collectionsSitemap();
    const listRanges = calls.ranges.filter(([t]) => t === "lists");
    expect(listRanges.every(([, a, b]) => a <= b)).toBe(true);
    expect(listRanges).toEqual([
      ["lists", 0, 999],
      ["lists", 1000, 1999],
    ]);
    // 2000 listas + 1 perfil, en dos idiomas.
    expect(entries).toHaveLength((MAX_PUBLIC_LISTS + 1) * 2);
  });

  it("muchas listas: .in() en lotes de 100 y list_items paginado (más de 1000 filas)", async () => {
    const nLists = 250;
    const lists = Array.from({ length: nLists }, (_, i) => ({
      id: `l${i}`,
      owner_id: `u${i % 3}`,
      created_at: "2026-09-01T00:00:00Z",
      is_public: true,
    }));
    // 12 títulos por lista → 3.000 filas, más que una página de PostgREST.
    const items = lists.flatMap((l) =>
      Array.from({ length: 12 }, (_, j) => ({ list_id: l.id, added_at: `2026-10-${String(1 + (j % 9)).padStart(2, "0")}T00:00:00Z` })),
    );
    const users = [0, 1, 2].map((i) => ({ id: `u${i}`, username: `user${i}` }));
    const calls = fakeSupabase({ lists, list_items: items, users });
    const entries = await collectionsSitemap();
    expect(Math.max(...calls.inSizes)).toBeLessThanOrEqual(IN_BATCH);
    // Lote de 100 listas = 1.200 filas → dos páginas.
    expect(calls.ranges.filter(([t]) => t === "list_items").length).toBeGreaterThan(Math.ceil(nLists / IN_BATCH));
    // Todas las listas (12 ≥ 5 títulos) y los 3 perfiles, en dos idiomas.
    expect(entries).toHaveLength((nLists + 3) * 2);
  });
});
