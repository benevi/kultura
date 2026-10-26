// ============================================================
// F-29 · Carga de adaptaciones: caché en tabla, Wikidata y pasos extra
// ============================================================

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/api/rawg", () => ({ getGame: vi.fn() }));

import responses from "./fixtures/wikidata-responses.json";
import {
  adaptationsCacheEnabled,
  loadAdaptationsUncached,
  openLibraryWorkOf,
  resolvePending,
  type CacheClient,
} from "@/lib/adaptations/load";
import { STORED_VERSION, type StoredAdaptations } from "@/lib/adaptations/model";

const NOW = Date.parse("2026-10-26T10:00:00Z");
const DAY = 86_400_000;
const DUNE = (responses as Record<string, unknown>)["movie_438631"];

/** Llamadas a WDQS (el mismo `fetchImpl` resuelve también ediciones de Open Library). */
const wdCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.filter(([url]) => String(url).startsWith("https://query.wikidata.org/")).length;

const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify(DUNE), { status: 200 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

function cacheClient(row: unknown, readError: { code: string } | null = null) {
  const upserts: unknown[] = [];
  const client: CacheClient = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: readError }) }) }),
      upsert: async (r: unknown) => {
        upserts.push(r);
        return { error: null };
      },
    }),
  };
  return { client, upserts };
}

const stored = (works = 1): StoredAdaptations => ({
  v: STORED_VERSION,
  qid: "Q1",
  works: Array.from({ length: works }, (_, i) => ({ mediaId: `book_OL${i + 1}W`, type: "book" as const, rel: "source" as const, qid: `Q${i + 2}`, en: "X" })),
  franchise: null,
});

afterEach(() => {
  delete process.env.ADAPTATIONS_CACHE;
});

describe("loadAdaptationsUncached", () => {
  it("sin forma equivalente en Wikidata: null y sin red", async () => {
    const fetchImpl = okFetch();
    expect(await loadAdaptationsUncached("book_zyTCAlFPjgYC", {}, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("caché fresca (30 días con datos): no pregunta a Wikidata", async () => {
    const fetchImpl = okFetch();
    const { client } = cacheClient({ media_id: "movie_438631", wikidata_id: "Q1", payload: stored(), fetched_at: new Date(NOW - 29 * DAY).toISOString() });
    expect(await loadAdaptationsUncached("movie_438631", {}, { cache: client, fetchImpl, now: () => NOW })).toEqual(stored());
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("caché vacía caduca antes (7 días) y se vuelve a pedir y a guardar", async () => {
    const fetchImpl = okFetch();
    const { client, upserts } = cacheClient({ media_id: "movie_438631", wikidata_id: null, payload: stored(0), fetched_at: new Date(NOW - 8 * DAY).toISOString() });
    const out = await loadAdaptationsUncached("movie_438631", {}, { cache: client, fetchImpl, now: () => NOW });
    expect(wdCalls(fetchImpl)).toBe(1);
    expect(out!.works.some((w) => w.mediaId === "movie_841")).toBe(true);
    expect(upserts).toEqual([
      expect.objectContaining({ media_id: "movie_438631", wikidata_id: out!.qid, fetched_at: new Date(NOW).toISOString() }),
    ]);
  });

  it("Wikidata caído: lo guardado aunque haya caducado; sin nada, null", async () => {
    const down = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    const { client, upserts } = cacheClient({ media_id: "movie_1", wikidata_id: "Q1", payload: stored(2), fetched_at: new Date(NOW - 90 * DAY).toISOString() });
    expect(await loadAdaptationsUncached("movie_1", {}, { cache: client, fetchImpl: down, now: () => NOW })).toEqual(stored(2));
    expect(upserts).toEqual([]);
    expect(await loadAdaptationsUncached("movie_1", {}, { fetchImpl: down })).toBeNull();
  });

  it("tabla sin aplicar (42P01): funciona igual, sin caché", async () => {
    const fetchImpl = okFetch();
    const { client } = cacheClient(null, { code: "42P01" });
    const out = await loadAdaptationsUncached("movie_438631", {}, { cache: client, fetchImpl, now: () => NOW });
    expect(out!.works.length).toBeGreaterThan(0);
  });

  it("payload de otra versión: se ignora y se vuelve a pedir", async () => {
    const fetchImpl = okFetch();
    const { client } = cacheClient({ media_id: "movie_438631", wikidata_id: "Q1", payload: { v: 0, works: [] }, fetched_at: new Date(NOW).toISOString() });
    await loadAdaptationsUncached("movie_438631", {}, { cache: client, fetchImpl, now: () => NOW });
    expect(wdCalls(fetchImpl)).toBe(1);
  });

  it("resuelve juegos por slug con la función inyectada", async () => {
    const tlou = (responses as Record<string, unknown>)["tv_100088"];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(tlou), { status: 200 })) as unknown as typeof fetch;
    const resolveRawg = vi.fn(async (slug: string) => (slug === "the-last-of-us" ? "3990" : null));
    const out = await loadAdaptationsUncached("tv_100088", {}, { fetchImpl, resolveRawg });
    expect(out!.works).toContainEqual(expect.objectContaining({ mediaId: "game_3990", rel: "source", type: "game" }));
  });
});

describe("resolvePending y openLibraryWorkOf", () => {
  it("edición → obra de Open Library", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/books/OL32815550M.json")
        ? new Response(JSON.stringify({ works: [{ key: "/works/OL17091839W" }] }), { status: 200 })
        : new Response("", { status: 404 }),
    ) as unknown as typeof fetch;
    expect(await openLibraryWorkOf("OL32815550M", fetchImpl)).toBe("OL17091839W");
    expect(await openLibraryWorkOf("OL1M", fetchImpl)).toBeNull();
    expect(await openLibraryWorkOf("x/../../etc", fetchImpl)).toBeNull();
    const map = await resolvePending(
      [
        { key: "ol:OL32815550M", kind: "olEdition", value: "OL32815550M" },
        { key: "rawg:x", kind: "rawg", value: "x" },
      ],
      { fetchImpl, resolveRawg: async () => {
        throw new Error("RAWG caído");
      } },
    );
    expect(Object.fromEntries(map)).toEqual({ "ol:OL32815550M": "book_OL17091839W" });
  });
});

describe("bandera", () => {
  it("ADAPTATIONS_CACHE=1 activa la tabla", () => {
    expect(adaptationsCacheEnabled()).toBe(false);
    process.env.ADAPTATIONS_CACHE = "1";
    expect(adaptationsCacheEnabled()).toBe(true);
  });
});
