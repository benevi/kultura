// @vitest-environment node
// ============================================================
// KULTURA — Relevancia de la búsqueda (F-13, DAT-9)
//
// Funciones puras de `search-rank.ts`. Los casos reproducen fallos medidos en
// producción (DAT §3.3, VERIF-D D11/D12): el proveedor devuelve la obra, pero
// no primera. Cada lista está en el ORDEN en que la devolvía el proveedor.
// ============================================================

import { describe, it, expect } from "vitest";
import type { MediaItem, MediaType } from "@/types/media";
import {
  isNonLatinTitle,
  MATCH_TIER,
  mergeByRelevance,
  rankSearchResults,
  titleMatchTier,
  titleWords,
} from "@/lib/api/search-rank";

let seq = 0;
function it_(type: MediaType, title: string, extra: Partial<MediaItem> = {}): MediaItem {
  seq++;
  return {
    id: `${type}_${seq}`,
    externalId: String(seq),
    type,
    title,
    poster: `https://img.example/${seq}.jpg`,
    ...extra,
  };
}

describe("titleWords", () => {
  it("sin acentos ni signos; romanos de 2+ letras a arábigos; × como x", () => {
    expect(titleWords("Baldur's Gate III")).toEqual(["baldurs", "gate", "3"]);
    expect(titleWords("SPY×FAMILY")).toEqual(["spy", "x", "family"]);
    expect(titleWords("Pokémon: Edición Púrpura")).toEqual(["pokemon", "edicion", "purpura"]);
  });

  it("no convierte una v o una x sueltas (V for Vendetta no es 5 for vendetta)", () => {
    expect(titleWords("V for Vendetta")).toEqual(["v", "for", "vendetta"]);
    expect(titleWords("X-Men")).toEqual(["x", "men"]);
  });
});

describe("titleMatchTier", () => {
  it("escalones", () => {
    expect(titleMatchTier("dark", "Dark")).toBe(MATCH_TIER.identical);
    expect(titleMatchTier("el hobbit", "El hobbit")).toBe(MATCH_TIER.identical);
    expect(titleMatchTier("el hobbit", "The Hobbit")).toBe(MATCH_TIER.exact);
    expect(titleMatchTier("sandman", "The Sandman")).toBe(MATCH_TIER.exact);
    expect(titleMatchTier("spiderman", "Spider-Man")).toBe(MATCH_TIER.compact);
    expect(titleMatchTier("dune", "Dune: Parte dos")).toBe(MATCH_TIER.base);
    expect(titleMatchTier("death note", "Death Note (Official Colored)")).toBe(MATCH_TIER.base);
    expect(titleMatchTier("tokyo ghoul", "Tokyo Ghoul Zakki")).toBe(MATCH_TIER.prefix);
    expect(titleMatchTier("tintin", "Les Aventures de Tintin")).toBe(MATCH_TIER.words);
    expect(titleMatchTier("inception", "Bikini Inception")).toBe(MATCH_TIER.words);
    expect(titleMatchTier("nana", "Nanatsusa")).toBe(MATCH_TIER.none);
  });

  it("consultas vacías o de signos no coinciden con nada", () => {
    expect(titleMatchTier("!!", "Dark")).toBe(MATCH_TIER.none);
    expect(titleMatchTier("dark", "")).toBe(MATCH_TIER.none);
  });
});

describe("isNonLatinTitle", () => {
  it("japonés, coreano o cirílico sin letras latinas", () => {
    expect(isNonLatinTitle("ベルセルク 1")).toBe(true);
    expect(isNonLatinTitle("Война и мир")).toBe(true);
    expect(isNonLatinTitle("【Oshi no Ko】")).toBe(false);
    expect(isNonLatinTitle("1984")).toBe(false);
  });
});

describe("rankSearchResults — casos medidos en producción", () => {
  it('serie "dark": Dark antes que Dark Shadows (DAT: el 2.º)', () => {
    const r = rankSearchResults("dark", [
      it_("tv", "Dark Shadows", { metadata: { voteCount: 400 } }),
      it_("tv", "Dark", { metadata: { voteCount: 7000 } }),
      it_("tv", "Dark Matter", { metadata: { voteCount: 900 } }),
    ]);
    expect(r[0].title).toBe("Dark");
  });

  it('"the office": a igualdad de título, la más votada (US antes que UK)', () => {
    const r = rankSearchResults("the office", [
      it_("tv", "The Office", { year: 2001, metadata: { voteCount: 1100 } }),
      it_("tv", "The Office", { year: 2005, metadata: { voteCount: 4300 } }),
    ]);
    expect(r[0].year).toBe(2005);
  });

  it('libro "el señor de los anillos": la edición española antes que la inglesa', () => {
    const r = rankSearchResults("el señor de los anillos", [
      it_("book", "The Lord of the Rings"),
      it_("book", "El Señor de los Anillos"),
      it_("book", "El Señor de los Anillos: La Comunidad del Anillo"),
    ]);
    expect(r.map((i) => i.title).slice(0, 2)).toEqual([
      "El Señor de los Anillos",
      "El Señor de los Anillos: La Comunidad del Anillo",
    ]);
  });

  it('libro "berserk": los tomos solo en japonés detrás (DAT §3.3)', () => {
    const r = rankSearchResults("berserk", [
      it_("book", "ベルセルク 1"),
      it_("book", "ベルセルク 2"),
      it_("book", "Berserk Deluxe Edition Volume 1"),
    ]);
    expect(r[0].title).toBe("Berserk Deluxe Edition Volume 1");
  });

  it('juego "hollow knight": el juego antes que la secuela', () => {
    const r = rankSearchResults("hollow knight", [
      it_("game", "Hollow Knight: Silksong", { metadata: { ratingsCount: 300 } }),
      it_("game", "Hollow Knight", { metadata: { ratingsCount: 3000 } }),
    ]);
    expect(r[0].title).toBe("Hollow Knight");
  });

  it('juego "baldur\'s gate 3" encuentra "Baldur\'s Gate III" como exacto', () => {
    const r = rankSearchResults("baldur's gate 3", [
      it_("game", "Baldur's Gate"),
      it_("game", "Baldur's Gate III"),
    ]);
    expect(r[0].title).toBe("Baldur's Gate III");
  });

  it('"inception": Bikini Inception nunca antes que Inception', () => {
    const r = rankSearchResults("inception", [it_("movie", "Bikini Inception"), it_("movie", "Inception")]);
    expect(r[0].title).toBe("Inception");
  });

  it("título alternativo: buscar en español encuentra la obra con título inglés", () => {
    const r = rankSearchResults("ataque a los titanes", [
      it_("manga", "Attack on Titan Anthology"),
      it_("manga", "Attack on Titan", { metadata: { altTitles: ["Ataque a los Titanes", "進撃の巨人"] } }),
    ]);
    expect(r[0].title).toBe("Attack on Titan");
  });

  it("sin portada va al final aunque el título coincida (no se pinta en el catálogo)", () => {
    const r = rankSearchResults("coco", [it_("movie", "Coco", { poster: undefined }), it_("movie", "Coco Chanel")]);
    expect(r[0].title).toBe("Coco Chanel");
  });

  it("estable: sin coincidencias de título se respeta el orden del proveedor", () => {
    const list = [it_("book", "Uno"), it_("book", "Dos"), it_("book", "Tres")];
    expect(rankSearchResults("stephen king", list).map((i) => i.title)).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("el desempate nunca hace saltar de escalón (popularidad enorme no gana a un título exacto)", () => {
    const r = rankSearchResults("monster", [
      it_("manga", "Monster Hunter Stories", { metadata: { follows: 5_000_000 } }),
      it_("manga", "Monster", { metadata: { follows: 3 } }),
    ]);
    expect(r[0].title).toBe("Monster");
  });
});

describe("mergeByRelevance (type=all)", () => {
  it('"dune": las obras que se llaman así primero, sea cual sea su familia', () => {
    const merged = mergeByRelevance("dune", [
      [it_("movie", "Dune: Parte dos"), it_("movie", "Dune")],
      [it_("tv", "Dune: La profecía")],
      [it_("book", "Dune")],
      [it_("comic", "Dune: House Atreides")],
      [it_("game", "Dune: Awakening")],
    ]);
    expect(merged.slice(0, 2).map((i) => `${i.type}:${i.title}`).sort()).toEqual(["book:Dune", "movie:Dune"]);
    expect(merged).toHaveLength(6);
  });

  it("sin coincidencias, equivale al intercalado por turnos de antes", () => {
    const a = [it_("movie", "A1"), it_("movie", "A2")];
    const b = [it_("book", "B1"), it_("book", "B2")];
    expect(mergeByRelevance("zzz", [a, b]).map((i) => i.title)).toEqual(["A1", "B1", "A2", "B2"]);
  });
});

describe("banco de relevancia (fixtures en el orden del proveedor)", () => {
  // [consulta, lista en el orden del proveedor, título esperado arriba]
  const BANK: [string, MediaItem[], string][] = [
    ["dark", [it_("tv", "Dark Shadows"), it_("tv", "Dark")], "Dark"],
    ["friends", [it_("tv", "Friends with Benefits"), it_("tv", "Friends")], "Friends"],
    ["the bear", [it_("tv", "The Bear"), it_("tv", "The Bear Grylls Show")], "The Bear"],
    ["avatar", [it_("movie", "Avatar: El sentido del agua"), it_("movie", "Avatar")], "Avatar"],
    ["coco", [it_("movie", "Coco Before Chanel"), it_("movie", "Coco")], "Coco"],
    ["el padrino", [it_("movie", "El padrino"), it_("movie", "El padrino. Parte II")], "El padrino"],
    ["spiderman", [it_("movie", "Spider-Man: No Way Home"), it_("movie", "Spider-Man")], "Spider-Man"],
    ["matrix", [it_("movie", "The Matrix Resurrections"), it_("movie", "Matrix")], "Matrix"],
    ["bleach", [it_("anime", "Bleach: Thousand-Year Blood War"), it_("anime", "Bleach")], "Bleach"],
    ["frieren", [it_("anime", "Frieren: Beyond Journey's End")], "Frieren: Beyond Journey's End"],
    ["minecraft", [it_("game", "Minecraft Dungeons"), it_("game", "Minecraft")], "Minecraft"],
    ["hades", [it_("game", "Hades II"), it_("game", "Hades")], "Hades"],
    ["celeste", [it_("game", "Celeste Classic"), it_("game", "Celeste")], "Celeste"],
    ["portal 2", [it_("game", "Portal"), it_("game", "Portal 2")], "Portal 2"],
    ["1984", [it_("book", "1984: Edición conmemorativa"), it_("book", "1984")], "1984"],
    ["dune", [it_("book", "Dune Messiah"), it_("book", "Dune")], "Dune"],
    ["rayuela", [it_("book", "Rayuela")], "Rayuela"],
    ["el hobbit", [it_("book", "The Hobbit"), it_("book", "El hobbit")], "El hobbit"],
    ["fahrenheit 451", [it_("book", "Fahrenheit 9/11"), it_("book", "Fahrenheit 451")], "Fahrenheit 451"],
    ["sapiens", [it_("book", "Sapiens: De animales a dioses")], "Sapiens: De animales a dioses"],
  ];

  it("top-1 correcto en ≥ 95 %", () => {
    const misses = BANK.filter(([q, list, want]) => rankSearchResults(q, list)[0]?.title !== want).map(
      ([q, list]) => `${q} → ${rankSearchResults(q, list)[0]?.title}`
    );
    expect(misses.length / BANK.length).toBeLessThanOrEqual(0.05);
    expect(misses).toEqual([]);
  });
});
