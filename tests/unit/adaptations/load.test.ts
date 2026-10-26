// ============================================================
// F-29 · Carga de adaptaciones: tabla, Wikidata y respaldo (PRO-11)
//
// Lo que se protege:
//   - fila vigente en `media_adaptations` → no se pregunta a Wikidata;
//   - sin fila o caducada → una consulta y se guarda con su TTL (30 d con
//     vínculos, 7 d sin ellos / sin título, 1 d si es parcial);
//   - sin la tabla (migración pendiente) → caché de datos de Next, sin escribir;
//   - Wikidata caído → la fila caducada si la hay; si no, nada y no se guarda;
//   - juegos: slug → número de RAWG (como mucho 4) y nunca con el cupo caliente.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, fakeClient, type FakeDb } from "../media/fake-supabase";
import { ProviderError } from "@/lib/api/http";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  runSparql: vi.fn(),
  providerFetch: vi.fn(),
  quotaHot: vi.fn(() => false),
  getGame: vi.fn(),
  getMangaDex: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient(h.db, "admin") }));
vi.mock("@/lib/api/wikidata", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/wikidata")>()),
  runSparql: h.runSparql,
}));
vi.mock("@/lib/api/http", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/http")>()),
  providerFetch: h.providerFetch,
  isProviderQuotaHot: h.quotaHot,
}));
vi.mock("@/lib/api/rawg", () => ({ getGame: h.getGame }));
vi.mock("@/lib/api/mangadex", () => ({
  getManga: h.getMangaDex,
  isMangaDexId: (id: string) => /^[0-9a-f-]{36}$/.test(id),
}));

import {
  ADAPTATIONS_TTL,
  MAX_GAME_LOOKUPS,
  claimHints,
  fetchAdaptations,
  getAdaptations,
} from "@/lib/adaptations/load";

const lit = (value: string) => ({ type: "literal", value });
const uri = (q: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${q}` });
const DUNE = { id: "movie_438631", type: "movie" as const, externalId: "438631" };

function rows(...items: Array<Record<string, string>>) {
  return {
    results: {
      bindings: items.map((it, i) => {
        const r: Record<string, { type: string; value: string }> = {
          work: uri(`Q${100 + i}`),
          subject_: uri("Q107009"),
          rels_: lit(it.rels ?? "source"),
          labelEn_: lit(it.label ?? `Obra ${i}`),
        };
        for (const [k, v] of Object.entries(it)) if (k !== "rels" && k !== "label") r[`${k}_`] = lit(v);
        return r;
      }),
    },
  };
}

const DAY_MS = 86_400_000;

beforeEach(() => {
  h.db = createFakeDb();
  h.runSparql.mockReset();
  h.providerFetch.mockReset();
  h.quotaHot.mockReset().mockReturnValue(false);
  h.getGame.mockReset();
  h.getMangaDex.mockReset();
});

describe("getAdaptations", () => {
  it("fila vigente en la tabla → sin consulta a Wikidata", async () => {
    h.db.tables.media_adaptations = [
      {
        media_id: "movie_438631",
        subject_qid: "Q107009",
        links: [
          { mediaId: "book_OL893415W", type: "book", externalId: "OL893415W", qid: "Q190192", labels: { es: "Dune" }, relations: ["source"] },
          { basura: true },
        ],
        status: "ok",
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      },
    ];
    const res = await getAdaptations(DUNE);
    expect(res.source).toBe("table");
    expect(res.links.map((l) => l.mediaId)).toEqual(["book_OL893415W"]);
    expect(h.runSparql).not.toHaveBeenCalled();
  });

  it("sin fila → consulta SIN caché de Next y guarda 30 días con vínculos", async () => {
    h.runSparql.mockResolvedValue(rows({ ol: "OL893415W", label: "Dune" }, { tmdbMovie: "841", rels: "sibling" }));
    const before = Date.now();
    const res = await getAdaptations(DUNE);
    expect(res.source).toBe("wikidata");
    expect(res.links.map((l) => l.mediaId)).toEqual(["book_OL893415W", "movie_841"]);
    expect(h.runSparql).toHaveBeenCalledWith(expect.stringContaining('wdt:P4947 "438631"'), { cache: false });
    const [row] = h.db.tables.media_adaptations;
    expect(row).toMatchObject({ media_id: "movie_438631", subject_qid: "Q107009", status: "ok" });
    const ttl = Date.parse(row.expires_at as string) - before;
    expect(ttl).toBeGreaterThanOrEqual(ADAPTATIONS_TTL.ok * 1000 - 5000);
    expect(ttl).toBeLessThanOrEqual(ADAPTATIONS_TTL.ok * 1000 + 5000);
  });

  it("Wikidata no conoce el título → 'not_found' 7 días (caché negativa)", async () => {
    h.runSparql.mockResolvedValue({ results: { bindings: [] } });
    await getAdaptations(DUNE);
    const [row] = h.db.tables.media_adaptations;
    expect(row.status).toBe("not_found");
    expect(Date.parse(row.expires_at as string) - Date.now()).toBeLessThanOrEqual(ADAPTATIONS_TTL.not_found * 1000 + 5000);
    expect(ADAPTATIONS_TTL.not_found).toBe(7 * 86_400);
  });

  it("sin la tabla (42P01) → caché de datos de Next con la TTL de 'ok' y sin escribir", async () => {
    h.db.failures.media_adaptations = { code: "42P01", message: 'relation "media_adaptations" does not exist' };
    h.runSparql.mockResolvedValue(rows({ ol: "OL893415W" }));
    const res = await getAdaptations({ ...DUNE, id: "movie_438631", externalId: "438631" });
    expect(res.links).toHaveLength(1);
    expect(h.runSparql).toHaveBeenCalledWith(expect.any(String), { cache: { revalidate: ADAPTATIONS_TTL.ok } });
    expect(h.db.writes).toEqual([]);
  });

  it("fila caducada y Wikidata caído → la caducada (mejor vieja que nada)", async () => {
    h.db.tables.media_adaptations = [
      {
        media_id: "movie_438631",
        subject_qid: "Q1",
        links: [{ mediaId: "movie_841", type: "movie", externalId: "841", qid: "Q2", labels: { en: "Dune" }, relations: ["sibling"] }],
        status: "ok",
        fetched_at: new Date(Date.now() - 40 * DAY_MS).toISOString(),
        expires_at: new Date(Date.now() - DAY_MS).toISOString(),
      },
    ];
    h.runSparql.mockRejectedValue(new ProviderError("wikidata" as never, "timeout", "lento"));
    const res = await getAdaptations(DUNE);
    expect(res).toMatchObject({ source: "stale", links: [{ mediaId: "movie_841" }] });
    expect(h.db.writes).toEqual([]);
  });

  it("sin fila y Wikidata caído → nada y no se guarda (el siguiente reintenta)", async () => {
    h.runSparql.mockRejectedValue(new ProviderError("wikidata" as never, "circuit_open", "abierto"));
    await expect(getAdaptations(DUNE)).resolves.toEqual({ links: [], source: "none" });
    expect(h.db.writes).toEqual([]);
  });

  it("título sin forma de buscarse (cómic sin número, MangaDex sin enlaces) → sin consulta", async () => {
    h.getMangaDex.mockResolvedValue({ data: { attributes: {} } });
    await expect(getAdaptations({ id: "manga_x", type: "manga", externalId: "a96676e5-8ae2-425e-b549-7f15dd34a6d8" })).resolves.toEqual({ links: [], source: "none" });
    expect(h.runSparql).not.toHaveBeenCalled();
  });

  it("manga de AniList con idMal: busca por las dos vías", async () => {
    h.runSparql.mockResolvedValue({ results: { bindings: [] } });
    await getAdaptations({ id: "manga_al-30002", type: "manga", externalId: "al-30002", metadata: { malId: 2 } });
    const query = h.runSparql.mock.calls[0][0] as string;
    expect(query).toContain('wdt:P8731 "30002"');
    expect(query).toContain('wdt:P4087 "2"');
  });
});

describe("claimHints", () => {
  it("juego: el slug sale de la ficha de RAWG", async () => {
    h.getGame.mockResolvedValue({ id: 3328, slug: "the-witcher-3-wild-hunt" });
    await expect(claimHints({ type: "game", externalId: "3328" })).resolves.toEqual({ rawgSlug: "the-witcher-3-wild-hunt" });
  });
  it("MangaDex: sus `links`", async () => {
    h.getMangaDex.mockResolvedValue({ data: { attributes: { links: { al: "30013" } } } });
    await expect(claimHints({ type: "manga", externalId: "a96676e5-8ae2-425e-b549-7f15dd34a6d8" })).resolves.toEqual({
      mangaDexLinks: { al: "30013" },
    });
  });
  it("si el proveedor falla, sin pista (no lanza)", async () => {
    h.getGame.mockRejectedValue(new Error("RAWG caído"));
    await expect(claimHints({ type: "game", externalId: "3328" })).resolves.toEqual({});
  });
});

describe("juegos: slug de Wikidata → número de RAWG", () => {
  const claim = { property: "P4983" as const, value: "94605" };

  it("resuelve hasta 4, quita los que RAWG no tiene y deja el resto fuera", async () => {
    h.runSparql.mockResolvedValue(
      rows(
        { rawg: "league-of-legends", rels: "source" },
        { rawg: "no-existe", rels: "franchise" },
        { rawg: "legends-of-runeterra", rels: "franchise" },
        { rawg: "teamfight-tactics", rels: "franchise" },
        { rawg: "ruined-king", rels: "franchise" }
      )
    );
    const ids: Record<string, number> = {
      "league-of-legends": 41494,
      "legends-of-runeterra": 362,
      // Mismo número que LoL (dos elementos de Wikidata para un juego): uno solo.
      "teamfight-tactics": 41494,
      "ruined-king": 9,
    };
    h.providerFetch.mockImplementation(async (_p: string, url: string) => {
      const slug = /\/games\/([^?]+)/.exec(url)![1];
      if (!(slug in ids)) throw new ProviderError("rawg", "http", "404", { status: 404 });
      return { id: ids[slug] };
    });
    const value = await fetchAdaptations("tv_94605", claim, false);
    expect(h.providerFetch).toHaveBeenCalledTimes(MAX_GAME_LOOKUPS);
    expect(h.providerFetch.mock.calls[0][0]).toBe("rawg");
    expect(h.providerFetch.mock.calls[0][1]).toContain("https://api.rawg.io/api/games/league-of-legends?key=");
    expect(h.providerFetch.mock.calls[0][2]).toMatchObject({ cache: { revalidate: 30 * 86_400 } });
    // El 5.º (ruined-king) no se busca: tope de 4 por consulta.
    expect(value.links.map((l) => l.mediaId)).toEqual(["game_41494", "game_362"]);
    expect(value.status).toBe("ok");
  });

  it("RAWG caído → 'partial' (TTL de 1 día)", async () => {
    h.runSparql.mockResolvedValue(rows({ rawg: "league-of-legends" }));
    h.providerFetch.mockRejectedValue(new ProviderError("rawg", "timeout", "lento"));
    const value = await fetchAdaptations("tv_94605", claim, false);
    expect(value).toMatchObject({ status: "partial", links: [] });
    expect(ADAPTATIONS_TTL.partial).toBe(86_400);
  });

  it("con el cupo de RAWG al 80 % no se gasta en esto", async () => {
    h.quotaHot.mockReturnValue(true);
    h.runSparql.mockResolvedValue(rows({ rawg: "league-of-legends" }, { ol: "OL1W", label: "Libro" }));
    const value = await fetchAdaptations("tv_94605", claim, false);
    expect(h.providerFetch).not.toHaveBeenCalled();
    expect(value.links.map((l) => l.mediaId)).toEqual(["book_OL1W"]);
    expect(value.status).toBe("partial");
  });
});
