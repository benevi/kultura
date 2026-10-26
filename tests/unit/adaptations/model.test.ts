// ============================================================
// F-29 · Modelo de adaptaciones: Wikidata → caché → vista
// ============================================================

import { describe, it, expect } from "vitest";
import { parseAdaptationsResponse, type WikidataAdaptations } from "@/lib/api/wikidata";
import {
  buildView,
  isStoredAdaptations,
  pendingRefs,
  rawgSlugFromUrl,
  toStored,
  MAX_ALSO_AS,
  STORED_VERSION,
} from "@/lib/adaptations/model";

const parsed = (works: WikidataAdaptations["works"], franchise: WikidataAdaptations["franchise"] = null): WikidataAdaptations => ({
  qid: "Q1",
  works,
  franchise,
});

describe("toStored", () => {
  it("un título de KULTURA por fila: gana la relación más fuerte y se completa lo que falte", () => {
    const stored = toStored(
      parsed([
        { qid: "Q3", rel: "franchise", en: "Dune (1984)", ids: { P4947: ["841"] } },
        { qid: "Q3", rel: "sibling", es: "Dune", year: 1984, ids: { P4947: ["841"] } },
        { qid: "Q2", rel: "source", en: "Dune", year: 1965, ids: { P648: ["OL893415W"] } },
      ]),
      "movie_438631",
    );
    expect(stored.v).toBe(STORED_VERSION);
    expect(stored.works).toEqual([
      { mediaId: "movie_841", type: "movie", rel: "sibling", qid: "Q3", es: "Dune", year: 1984, en: "Dune (1984)" },
      { mediaId: "book_OL893415W", type: "book", rel: "source", qid: "Q2", en: "Dune", year: 1965 },
    ]);
  });

  it("nunca el propio título, ni lo que no tiene id que KULTURA abra", () => {
    const stored = toStored(
      parsed([
        { qid: "Q1", rel: "adaptation", en: "Yo", ids: { P4947: ["438631"] } },
        { qid: "Q9", rel: "franchise", en: "Alia Atreides", ids: { P5905: ["4005-65182"] } },
      ]),
      "movie_438631",
    );
    expect(stored.works).toEqual([]);
  });

  it("juego y edición de Open Library: solo si se resolvieron", () => {
    const p = parsed([
      { qid: "Q5", rel: "source", en: "The Last of Us", ids: { P9968: ["the-last-of-us"] } },
      { qid: "Q6", rel: "source", en: "The Martian", ids: { P648: ["OL32815550M"] } },
    ]);
    expect(pendingRefs(p)).toEqual([
      { key: "rawg:the-last-of-us", kind: "rawg", value: "the-last-of-us" },
      { key: "ol:OL32815550M", kind: "olEdition", value: "OL32815550M" },
    ]);
    expect(toStored(p, "tv_100088").works).toEqual([]);
    const resolved = new Map([
      ["rawg:the-last-of-us", "game_3990"],
      ["ol:OL32815550M", "book_OL17091839W"],
    ]);
    expect(toStored(p, "tv_100088", resolved).works.map((w) => w.mediaId)).toEqual(["game_3990", "book_OL17091839W"]);
  });

  it("isStoredAdaptations rechaza lo viejo o roto", () => {
    expect(isStoredAdaptations(toStored(parsed([]), "movie_1"))).toBe(true);
    expect(isStoredAdaptations({ v: 0, works: [] })).toBe(false);
    expect(isStoredAdaptations({})).toBe(false);
    expect(isStoredAdaptations(null)).toBe(false);
  });
});

describe("buildView", () => {
  it("etiqueta en el idioma de la página, con la otra de respaldo", () => {
    const stored = toStored(
      parsed([
        { qid: "Q2", rel: "source", es: "El marciano", en: "The Martian", ids: { P648: ["OL1W"] } },
        { qid: "Q3", rel: "adaptation", en: "Solo inglés", ids: { P4947: ["2"] } },
        { qid: "Q4", rel: "adaptation", ids: { P4947: ["3"] } },
      ]),
      "movie_1",
    );
    expect(buildView(stored, "movie_1", "es").alsoAs.map((l) => l.title)).toEqual(["El marciano", "Solo inglés"]);
    expect(buildView(stored, "movie_1", "en").alsoAs.map((l) => l.title)).toEqual(["The Martian", "Solo inglés"]);
  });

  it("origen directo primero; los tomos de la saga detrás y como mucho dos; tope total", () => {
    const works: WikidataAdaptations["works"] = [
      { qid: "Q2", rel: "source", en: "Fullmetal Alchemist", ids: { P8731: ["30025"] } },
      ...Array.from({ length: 10 }, (_, i) => ({
        qid: `Q${10 + i}`,
        rel: "source" as const,
        part: true as const,
        en: `Volume ${i + 1}`,
        year: 2001 + i,
        ids: { P648: [`OL${i + 1}W`] },
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        qid: `Q${100 + i}`,
        rel: "adaptation" as const,
        en: `Adaptación ${i}`,
        year: 2010 + i,
        ids: { P4947: [String(1000 + i)] },
      })),
    ];
    const view = buildView(toStored(parsed(works, { qid: "Q99", en: "FMA" }), "anime_al-5114"), "anime_al-5114", "en");
    expect(view.alsoAs[0]).toMatchObject({ title: "Fullmetal Alchemist", rel: "source" });
    expect(view.alsoAs.filter((l) => l.part)).toHaveLength(2);
    expect(view.alsoAs).toHaveLength(MAX_ALSO_AS);
    // Los tomos no son "la franquicia".
    expect(view.franchise!.members.some((m) => m.part)).toBe(false);
  });

  it("franquicia solo con nombre y al menos dos títulos", () => {
    const one = toStored(parsed([{ qid: "Q2", rel: "franchise", en: "A", ids: { P4947: ["2"] } }], { qid: "Q9", en: "Saga" }), "movie_1");
    expect(buildView(one, "movie_1", "en").franchise).toBeNull();
    const two = toStored(
      parsed(
        [
          { qid: "Q2", rel: "franchise", en: "B", year: 2001, ids: { P4947: ["2"] } },
          { qid: "Q3", rel: "franchise", en: "A", year: 1999, ids: { P4983: ["3"] } },
        ],
        { qid: "Q9", es: "Saga" },
      ),
      "movie_1",
    );
    expect(buildView(two, "movie_1", "en").franchise).toMatchObject({ name: "Saga", members: [{ title: "A" }, { title: "B" }] });
    expect(buildView(null, "movie_1", "es")).toEqual({ alsoAs: [], franchise: null });
  });

  it("sourcePart de Wikidata llega como origen indirecto", () => {
    const p = parseAdaptationsResponse({
      results: {
        bindings: [
          {
            item: { value: "http://www.wikidata.org/entity/Q1" },
            other: { value: "http://www.wikidata.org/entity/Q2" },
            rel: { value: "sourcePart" },
            en: { value: "The Last Wish" },
            ids: { value: "P648=OL1W" },
          },
        ],
      },
    });
    expect(p.works[0]).toMatchObject({ rel: "source", part: true });
  });
});

describe("rawgSlugFromUrl", () => {
  it("solo slugs de rawg.io, nunca un id numérico", () => {
    expect(rawgSlugFromUrl("https://rawg.io/games/the-witcher-3-wild-hunt")).toBe("the-witcher-3-wild-hunt");
    expect(rawgSlugFromUrl("https://rawg.io/games/3328")).toBeUndefined();
    expect(rawgSlugFromUrl("https://example.com/games/x")).toBeUndefined();
    expect(rawgSlugFromUrl(undefined)).toBeUndefined();
  });
});
