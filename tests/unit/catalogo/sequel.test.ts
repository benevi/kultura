// KULTURA — isSequelFor: un número suelto de dos cifras escrito en arábigos
// forma parte del título («Apollo 13», «Ocean's 11»), no lo marca como
// secuela. Sí lo es un 2-9 suelto o un número romano («Final Fantasy XVI»).

import { describe, it, expect } from "vitest";
import { isSequelFor, relevanceScore, titleWords } from "@/lib/api/search-rank";
import type { MediaItem } from "@/types/media";

describe("isSequelFor", () => {
  it.each([
    ["apollo", "Apollo 13"],
    ["ocean's", "Ocean's 11"],
    ["days later", "28 Days Later"],
    ["number", "The Number 23"],
  ])("«%s» → «%s» no es secuela", (q, title) => {
    expect(isSequelFor(q, title)).toBe(false);
  });

  it.each([
    ["toy story", "Toy Story 3"],
    ["hades", "Hades II"],
    ["final fantasy", "Final Fantasy XVI"],
    ["street fighter", "Street Fighter II"],
    ["frieren", "Frieren: Season 2"],
    ["dune", "Dune: Part Two"],
  ])("«%s» → «%s» sí es secuela", (q, title) => {
    expect(isSequelFor(q, title)).toBe(true);
  });

  it("con número en la consulta no penaliza nada", () => {
    expect(isSequelFor("portal 2", "Portal 2")).toBe(false);
    expect(isSequelFor("apollo 13", "Apollo 18")).toBe(false);
  });

  it("«apollo»: Apollo 13 puntúa como cualquier otro «Apollo …» sin número", () => {
    const item = (title: string): MediaItem => ({
      id: "movie_1",
      externalId: "1",
      type: "movie",
      title,
      poster: "https://img/x.jpg",
      metadata: { voteCount: 6000 },
    });
    expect(relevanceScore("apollo", item("Apollo 13"), 0)).toBe(
      relevanceScore("apollo", item("Apollo Ever"), 0)
    );
  });
});

describe("titleWords", () => {
  it("una palabra que coincide con una propiedad de Object se queda como texto", () => {
    expect(titleWords("The Constructor")).toEqual(["the", "constructor"]);
    expect(titleWords("Final Fantasy XVI")).toEqual(["final", "fantasy", "16"]);
  });
});
