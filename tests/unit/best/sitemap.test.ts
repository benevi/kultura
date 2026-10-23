import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
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
    { format: "anime", year: 2026, selection: selection("anime", 20, "2026-10-22T05:00:00.000Z") },
    { format: "anime", year: 2025, selection: selection("anime", 20, "2026-10-21T05:00:00.000Z", 100) },
    { format: "movie", year: 2026, selection: selection("movie", 5) }, // corta → noindex
    { format: "game", year: 2026, selection: null }, // proveedor caído
  ];

  it("hubs siempre; rankings solo los indexables, con la fecha real de su selección", () => {
    const urls = rankingsSitemap(snapshots).map((e) => e.url);
    expect(urls).toContain("https://x.app/es/best");
    for (const f of BEST_FORMATS) expect(urls).toContain(`https://x.app/en/best/${f}`);
    expect(urls).toContain("https://x.app/es/best/anime/2026");
    expect(urls).not.toContain("https://x.app/es/best/movie/2026");
    expect(urls).not.toContain("https://x.app/es/best/game/2026");
    const anime = rankingsSitemap(snapshots).find((e) => e.url === "https://x.app/es/best/anime/2025");
    expect(anime?.lastModified).toBe("2026-10-21T05:00:00.000Z");
    const hub = rankingsSitemap(snapshots).find((e) => e.url === "https://x.app/es/best/anime");
    expect(hub?.lastModified).toBe("2026-10-22T05:00:00.000Z");
  });

  it("fichas: los títulos de los rankings indexables, sin repetir, con el formato de id de MediaCard", () => {
    const dup: RankingSnapshot[] = [
      ...snapshots,
      { format: "anime", year: 2024, selection: selection("anime", 10, "2026-10-23T00:00:00.000Z") },
    ];
    const urls = titlesSitemap(dup).map((e) => e.url);
    expect(urls).toContain("https://x.app/es/media/anime/0");
    expect(urls).toContain("https://x.app/en/media/anime/100");
    expect(urls.some((u) => u.includes("/media/movie/"))).toBe(false); // ranking corto
    expect(new Set(urls).size).toBe(urls.length);
    // Título en dos rankings: la fecha más reciente.
    expect(titlesSitemap(dup).find((e) => e.url === "https://x.app/es/media/anime/0")?.lastModified).toBe(
      "2026-10-23T00:00:00.000Z",
    );
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

  it("consulta solo listas públicas", async () => {
    const eq = vi.fn().mockReturnThis();
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    supabase.createClient.mockReturnValue({ from: vi.fn(() => chain) });
    expect(await collectionsSitemap()).toEqual([]);
    expect(eq).toHaveBeenCalledWith("is_public", true);
    expect(supabase.createClient).toHaveBeenCalledWith("https://sb.example", "anon", expect.anything());
  });
});
