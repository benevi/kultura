// ============================================================
// F-29 · Wikidata: id de KULTURA ↔ Wikidata, consulta y respuesta
// ============================================================

import { describe, it, expect, vi } from "vitest";
import {
  buildAdaptationsQuery,
  fetchAdaptations,
  kulturaIdFor,
  parseAdaptationsResponse,
  wikidataKeyFor,
  WikidataError,
} from "@/lib/api/wikidata";

describe("wikidataKeyFor", () => {
  it.each([
    ["movie_438631", { prop: "P4947", value: "438631" }],
    ["tv_1399", { prop: "P4983", value: "1399" }],
    ["anime_al-16498", { prop: "P8729", value: "16498" }],
    ["anime_tmdb-1429", { prop: "P4983", value: "1429" }],
    ["anime_1535", { prop: "P4086", value: "1535" }],
    ["manga_al-30002", { prop: "P8731", value: "30002" }],
    ["manga_2", { prop: "P4087", value: "2" }],
    ["book_OL893415W", { prop: "P648", value: "OL893415W" }],
    ["comic_6686", { prop: "P5905", value: "4000-6686" }],
  ])("%s", (id, key) => {
    expect(wikidataKeyFor(id)).toEqual(key);
  });

  it("juego: solo con slug de RAWG válido", () => {
    expect(wikidataKeyFor("game_3328")).toBeNull();
    expect(wikidataKeyFor("game_3328", { rawgSlug: "the-witcher-3-wild-hunt" })).toEqual({
      prop: "P9968",
      value: "the-witcher-3-wild-hunt",
    });
    expect(wikidataKeyFor("game_3328", { rawgSlug: 'x" } ; DROP' })).toBeNull();
  });

  it("formas sin equivalente o raras → null", () => {
    for (const id of [
      "manga_0a1b2c3d-1111-2222-3333-444455556666",
      "book_zyTCAlFPjgYC",
      "book_OL7353617M",
      "movie_abc",
      "podcast_1",
      "movie",
      "",
    ]) {
      expect(wikidataKeyFor(id), id).toBeNull();
    }
  });
});

describe("buildAdaptationsQuery", () => {
  it("busca por la propiedad y el valor, con las cuatro relaciones y las etiquetas", () => {
    const q = buildAdaptationsQuery({ prop: "P4947", value: "438631" });
    expect(q).toContain('?item wdt:P4947 "438631"');
    for (const rel of ['"source"', '"adaptation"', '"sibling"', '"franchise"', '"franchiseRoot"', '"seriesRoot"']) {
      expect(q).toContain(rel);
    }
    expect(q).toContain("wdt:P144");
    expect(q).toContain('LANG(?mulL) = "mul"');
    expect(q).toMatch(/LIMIT \d+/);
  });

  it("escapa el valor y rechaza una propiedad inventada", () => {
    expect(buildAdaptationsQuery({ prop: "P1", value: 'a"b\\c' })).toContain('"a\\"b\\\\c"');
    expect(() => buildAdaptationsQuery({ prop: "wdt:P1 . ?x", value: "1" })).toThrow();
  });
});

const row = (over: Record<string, string>) =>
  Object.fromEntries(Object.entries({ item: "http://www.wikidata.org/entity/Q1", ...over }).map(([k, v]) => [k, { value: v }]));

describe("parseAdaptationsResponse", () => {
  it("obras, franquicia, año y etiqueta `mul` de respaldo", () => {
    const parsed = parseAdaptationsResponse({
      results: {
        bindings: [
          row({ other: "http://www.wikidata.org/entity/Q2", rel: "source", es: "Dune", en: "Dune", date: "1965-08-01T00:00:00Z", ids: "P648=OL893461W|P648=OL893415W" }),
          row({ other: "http://www.wikidata.org/entity/Q3", rel: "sibling", mul: "Dune", date: "1984-12-03T00:00:00Z", ids: "P4947=841" }),
          row({ other: "http://www.wikidata.org/entity/Q4", rel: "franchiseRoot", es: "Dune (franquicia)" }),
          row({ other: "http://www.wikidata.org/entity/Q5", rel: "seriesRoot", en: "Dune saga" }),
          row({ other: "http://www.wikidata.org/entity/Q6", rel: "raro", ids: "P4947=1" }),
          row({ rel: "source" }),
        ],
      },
    });
    expect(parsed.qid).toBe("Q1");
    expect(parsed.franchise).toEqual({ qid: "Q4", es: "Dune (franquicia)", en: undefined });
    expect(parsed.works).toEqual([
      { qid: "Q2", rel: "source", es: "Dune", en: "Dune", year: 1965, ids: { P648: ["OL893415W", "OL893461W"] } },
      { qid: "Q3", rel: "sibling", es: "Dune", en: "Dune", year: 1984, ids: { P4947: ["841"] } },
    ]);
  });

  it("sin franquicia, la serie (P179)", () => {
    const parsed = parseAdaptationsResponse({
      results: { bindings: [row({ other: "http://www.wikidata.org/entity/Q5", rel: "seriesRoot", en: "Saga" })] },
    });
    expect(parsed.franchise).toEqual({ qid: "Q5", es: undefined, en: "Saga" });
  });

  it("nunca lanza con respuestas raras", () => {
    for (const junk of [null, undefined, {}, { results: {} }, { results: { bindings: "x" } }, "texto"]) {
      expect(parseAdaptationsResponse(junk)).toEqual({ qid: null, works: [], franchise: null });
    }
  });
});

describe("kulturaIdFor", () => {
  it("prioridad: anime > serie > película > manga > cómic > libro > juego", () => {
    expect(kulturaIdFor({ P4947: ["129"], P8729: ["199"], P4086: ["199"] })).toEqual({ type: "anime", mediaId: "anime_al-199" });
    expect(kulturaIdFor({ P4086: ["199"] })).toEqual({ type: "anime", mediaId: "anime_199" });
    expect(kulturaIdFor({ P4983: ["1399"], P4947: ["1"] })).toEqual({ type: "tv", mediaId: "tv_1399" });
    expect(kulturaIdFor({ P4947: ["841"], P648: ["OL1W"] })).toEqual({ type: "movie", mediaId: "movie_841" });
    expect(kulturaIdFor({ P8731: ["30002"], P4087: ["2"] })).toEqual({ type: "manga", mediaId: "manga_al-30002" });
    expect(kulturaIdFor({ P4087: ["2"] })).toEqual({ type: "manga", mediaId: "manga_2" });
    expect(kulturaIdFor({ P5905: ["4000-6686"] })).toEqual({ type: "comic", mediaId: "comic_6686" });
    expect(kulturaIdFor({ P648: ["OL1M", "OL893415W"] })).toEqual({ type: "book", mediaId: "book_OL893415W" });
    expect(kulturaIdFor({ P648: ["OL32815550M"] })).toEqual({ type: "book", mediaId: null, olEdition: "OL32815550M" });
    expect(kulturaIdFor({ P9968: ["the-last-of-us"] })).toEqual({ type: "game", mediaId: null, rawgSlug: "the-last-of-us" });
  });

  it("lo que KULTURA no abre → null (personajes de Comic Vine, nada)", () => {
    expect(kulturaIdFor({ P5905: ["4005-65182"] })).toBeNull();
    expect(kulturaIdFor({ P5905: ["4050-1"] })).toBeNull();
    expect(kulturaIdFor({})).toBeNull();
  });
});

describe("fetchAdaptations", () => {
  const key = { prop: "P4947", value: "438631" };

  it("pide WDQS con User-Agent y devuelve lo parseado", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ results: { bindings: [row({ other: "http://www.wikidata.org/entity/Q2", rel: "source", en: "Dune", ids: "P648=OL893415W" })] } }), { status: 200 }),
    );
    const out = await fetchAdaptations(key, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(out.works).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?query=/);
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/KulturaBot/);
  });

  it("errores de red, HTTP y JSON → WikidataError", async () => {
    const boom = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(fetchAdaptations(key, { fetchImpl: boom as unknown as typeof fetch })).rejects.toBeInstanceOf(WikidataError);
    const http = vi.fn(async () => new Response("busy", { status: 429 }));
    await expect(fetchAdaptations(key, { fetchImpl: http as unknown as typeof fetch })).rejects.toMatchObject({ status: 429 });
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(fetchAdaptations(key, { fetchImpl: notJson as unknown as typeof fetch })).rejects.toBeInstanceOf(WikidataError);
  });
});
