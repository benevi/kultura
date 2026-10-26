// ============================================================
// F-29 · Cliente SPARQL de Wikidata (PRO-11)
//
// Lo que se protege:
//   - cada formato se busca por la propiedad de Wikidata correcta (P-ids
//     comprobados en Wikidata) y solo con valores de forma validada;
//   - la consulta no cae en las trampas de Blazegraph que se vieron en vivo
//     (alias = variable → 500 StackOverflow; `wdt:P179?` → 504; BIND en rama
//     aparte → casa con todo Wikidata);
//   - la petición sale con User-Agent identificativo, plazo y circuito de
//     `providerFetch` (proveedor "wikidata").
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import {
  WD,
  WIKIDATA_PROVIDER,
  WIKIDATA_TIMEOUT_MS,
  bindingValue,
  buildAdaptationsQuery,
  runSparql,
  subjectClaim,
  subjectClaims,
} from "@/lib/api/wikidata";
import { providerCircuitState, resetProviderCircuits, ProviderError } from "@/lib/api/http";

describe("propiedades de Wikidata", () => {
  it("son las comprobadas en Wikidata (no inventadas)", () => {
    expect(WD).toMatchObject({
      basedOn: "P144",
      derivativeWork: "P4969",
      mediaFranchise: "P8345",
      partOfSeries: "P179",
      tmdbMovie: "P4947",
      tmdbTv: "P4983",
      anilistAnime: "P8729",
      anilistManga: "P8731",
      malAnime: "P4086",
      malManga: "P4087",
      openLibrary: "P648",
      rawgGame: "P9968",
      comicVine: "P5905",
    });
  });
});

describe("subjectClaim: cómo se busca cada formato", () => {
  it.each([
    ["movie", "438631", {}, { property: "P4947", value: "438631" }],
    ["tv", "1399", {}, { property: "P4983", value: "1399" }],
    ["anime", "al-16498", {}, { property: "P8729", value: "16498" }],
    ["anime", "tmdb-1429", {}, { property: "P4983", value: "1429" }],
    ["anime", "1535", {}, { property: "P4086", value: "1535" }],
    ["manga", "al-30002", {}, { property: "P8731", value: "30002" }],
    ["manga", "2", {}, { property: "P4087", value: "2" }],
    ["book", "OL893415W", {}, { property: "P648", value: "OL893415W" }],
    ["book", "zyTCAlFPjgYC", {}, { property: "P675", value: "zyTCAlFPjgYC" }],
    ["game", "3328", { rawgSlug: "the-witcher-3-wild-hunt" }, { property: "P9968", value: "the-witcher-3-wild-hunt" }],
    ["comic", "6686", {}, { property: "P5905", value: "4000-6686" }],
  ] as const)("%s %s", (type, id, hints, expected) => {
    expect(subjectClaim(type, id, hints)).toEqual(expected);
  });

  it("MangaDex: por los ids de AniList / MAL que publica en `links`", () => {
    const uuid = "a96676e5-8ae2-425e-b549-7f15dd34a6d8";
    expect(subjectClaim("manga", uuid, { mangaDexLinks: { al: "30013", mal: "13" } })).toEqual({
      property: "P8731",
      value: "30013",
    });
    expect(subjectClaim("manga", uuid, { mangaDexLinks: { mal: "13" } })).toEqual({ property: "P4087", value: "13" });
    expect(subjectClaim("manga", uuid, {})).toBeNull();
  });

  it("sin forma válida no hay consulta (el valor va dentro del SPARQL)", () => {
    expect(subjectClaim("movie", '1" } ?x ?y ?z . #')).toBeNull();
    expect(subjectClaim("game", "3328", {})).toBeNull();
    expect(subjectClaim("game", "3328", { rawgSlug: 'x" . ?a ?b ?c' })).toBeNull();
    expect(subjectClaim("book", "OL1W; DROP")).toBeNull();
  });

  it("subjectClaims añade la vía de MyAnimeList sin repetir", () => {
    expect(subjectClaims("manga", "al-30002", { malId: 2 })).toEqual([
      { property: "P8731", value: "30002" },
      { property: "P4087", value: "2" },
    ]);
    expect(subjectClaims("manga", "2", { malId: 2 })).toEqual([{ property: "P4087", value: "2" }]);
    expect(subjectClaims("movie", "550", { malId: 3 })).toEqual([{ property: "P4947", value: "550" }]);
  });
});

describe("buildAdaptationsQuery", () => {
  const q = buildAdaptationsQuery({ property: "P4947", value: "438631" });

  it("busca por el id y recorre P144 en los dos sentidos, P4969, hermanas y franquicia", () => {
    expect(q).toContain('?seed wdt:P4947 "438631" .');
    expect(q).toContain("?subject wdt:P144 ?work");
    expect(q).toContain("?work wdt:P144 ?subject");
    expect(q).toContain("?subject wdt:P4969 ?work");
    expect(q).toContain("?work wdt:P4969 ?subject");
    expect(q).toContain("?work wdt:P8345 ?fr");
    // Libros de la saga en la que se basa (The Witcher → "El último deseo").
    expect(q).toContain("?subject wdt:P144 ?saga . ?work wdt:P179 ?saga");
  });

  it("temporada → serie: BIND en la misma rama que fija ?seed y sin camino `P179?`", () => {
    expect(q).toContain('{ ?seed wdt:P4947 "438631" . BIND(?seed AS ?subject) }');
    expect(q).toContain('{ ?seed wdt:P4947 "438631" . ?seed wdt:P179 ?subject . }');
    expect(q).not.toMatch(/wdt:P179\?/);
    expect(q).not.toMatch(/\{\s*BIND\(\?seed AS \?subject\)\s*\}/);
  });

  it("ningún alias de agregado reutiliza el nombre de su variable (500 StackOverflow en WDQS)", () => {
    const aliases = [...q.matchAll(/\((?:SAMPLE|MIN|MAX|GROUP_CONCAT)\(\s*(?:DISTINCT\s+)?\?(\w+)[^)]*\)\s+AS\s+\?(\w+)\)/g)];
    expect(aliases.length).toBeGreaterThanOrEqual(12);
    for (const [, from, to] of aliases) expect(to).not.toBe(from);
  });

  it("pide etiqueta es, en y mul, y ordena por relación antes de cortar", () => {
    expect(q).toContain('FILTER(LANG(?labelMul) = "mul")');
    expect(q).toMatch(/ORDER BY \?prio_ \?date_\s+LIMIT 80/);
  });

  it("varias vías → UNION de semillas; sin vías, error", () => {
    const multi = buildAdaptationsQuery([
      { property: "P8731", value: "30002" },
      { property: "P4087", value: "2" },
    ]);
    expect(multi).toContain('?seed wdt:P8731 "30002"');
    expect(multi).toContain('?seed wdt:P4087 "2"');
    expect(() => buildAdaptationsQuery([])).toThrow();
  });

  it("escapa comillas y barras aunque el valor ya venga validado", () => {
    const evil = buildAdaptationsQuery({ property: "P4947", value: 'a"b\\c' });
    expect(evil).toContain('"a\\"b\\\\c"');
  });
});

describe("bindingValue", () => {
  it("lee la variable o su alias con `_` y quita el prefijo de entidad", () => {
    const row = {
      work: { type: "uri", value: "http://www.wikidata.org/entity/Q190192" },
      rels_: { type: "literal", value: "source" },
    };
    expect(bindingValue(row, "work")).toBe("Q190192");
    expect(bindingValue(row, "rels")).toBe("source");
    expect(bindingValue(row, "nada")).toBeUndefined();
  });
});

describe("runSparql", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.PROVIDER_CONTACT;
  });

  it("GET a WDQS con User-Agent de KULTURA, contacto y Accept SPARQL JSON", async () => {
    process.env.PROVIDER_CONTACT = "victor@example.com";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ head: { vars: [] }, results: { bindings: [{ work: { type: "uri", value: "x" } }] } }), {
        status: 200,
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await runSparql("SELECT 1", { cache: false });
    expect(res.results.bindings).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith("https://query.wikidata.org/sparql?")).toBe(true);
    expect(new URL(url).searchParams.get("query")).toBe("SELECT 1");
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe("application/sparql-results+json");
    expect(headers["User-Agent"]).toMatch(/^KULTURA\/1\.0 \(\+https:\/\/\S+; victor@example\.com\)$/);
    expect(init.cache).toBe("no-store");
  });

  it("plazo de 8 s por intento", () => {
    expect(WIKIDATA_TIMEOUT_MS).toBe(8000);
  });

  it("los fallos cuentan en el circuito propio de Wikidata", async () => {
    globalThis.fetch = vi.fn(async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    for (let i = 0; i < 5; i++) {
      await expect(runSparql("SELECT 1", { cache: false })).rejects.toBeInstanceOf(ProviderError);
    }
    expect(providerCircuitState(WIKIDATA_PROVIDER)).toBe("open");
    expect(providerCircuitState("tmdb")).toBe("closed");
  });

  it("respuesta sin `bindings` (contrato roto en modo log) → lista vacía, no revienta", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ oops: true }), { status: 200 })) as unknown as typeof fetch;
    await expect(runSparql("SELECT 1", { cache: false })).resolves.toEqual({ results: { bindings: [] } });
  });
});
