/**
 * Contrato — Relevancia de la búsqueda (F-13, DAT-12).
 *
 * Banco de regresión contra los proveedores REALES, con el mismo código que
 * producción (`searchByTypePaged`: buscador del proveedor + `rankSearchResults`).
 * Falla si el top-1 baja del 90 % en una familia (cómic: serie correcta en el
 * top-3 < 80 %). Lo lanza cada semana `contract.yml`; el banco completo
 * (≥ 140 consultas, contra la web) es `trabajo/DAT/rel.py`.
 *
 * Gasta: RAWG 5 peticiones, ComicVine 5 del recurso `search`, TMDB 10; el
 * resto (AniList, MangaDex, Open Library) no tiene clave ni cupo mensual.
 */
import { it, expect } from "vitest";
import { describe } from "vitest";
import { describeWithKeys, pause } from "./helpers";
import { searchByTypePaged } from "@/lib/api/search";
import type { MediaItem, MediaType } from "@/types/media";

type Case = [query: string, expected: RegExp];

const titlesOf = (i: MediaItem) => `${i.title} | ${i.originalTitle ?? ""}`;

async function topHits(type: MediaType, cases: Case[], depth: number, gapMs: number) {
  const misses: string[] = [];
  for (const [q, rx] of cases) {
    const res = await searchByTypePaged(q, type, 1, "es");
    const ok = res.items.slice(0, depth).some((i) => rx.test(titlesOf(i)));
    if (!ok) misses.push(`${q} → ${res.items.slice(0, depth).map((i) => i.title).join(" / ")}`);
    await pause(gapMs);
  }
  return { ratio: 1 - misses.length / cases.length, misses };
}

const MOVIE_TV: [MediaType, Case][] = [
  ["movie", ["el padrino", /padrino|godfather/i]],
  ["movie", ["interstellar", /interstellar|interestelar/i]],
  ["movie", ["coco", /^coco \|/i]],
  ["movie", ["avatar", /^avatar \|/i]],
  ["movie", ["inception", /^origen|inception/i]],
  ["tv", ["dark", /^dark \|/i]],
  ["tv", ["friends", /^friends \|/i]],
  ["tv", ["breaking bad", /breaking bad/i]],
  ["tv", ["the office", /^the office/i]],
  ["tv", ["shogun", /sh[oō]gun/i]],
];

describeWithKeys(["TMDB_API_KEY"], "Relevancia — cine y series (TMDB)", () => {
  it("top-1 ≥ 90 %", async () => {
    const misses: string[] = [];
    for (const [type, c] of MOVIE_TV) {
      const r = await topHits(type, [c], 1, 300);
      misses.push(...r.misses);
    }
    expect(1 - misses.length / MOVIE_TV.length, misses.join("; ")).toBeGreaterThanOrEqual(0.9);
  });
});

describe("Relevancia — anime (AniList), manga (MangaDex) y libros (Open Library)", () => {
  it("anime: top-1 ≥ 90 %", async () => {
    const r = await topHits(
      "anime",
      [
        ["naruto", /^naruto \|/i],
        ["death note", /death note/i],
        ["bleach", /^bleach/i],
        ["frieren", /frieren|sousou/i],
        ["cowboy bebop", /cowboy bebop/i],
        ["one punch man", /one.punch/i],
      ],
      1,
      800
    );
    expect(r.ratio, r.misses.join("; ")).toBeGreaterThanOrEqual(0.9);
  });

  it("manga: top-1 ≥ 90 % y la mayoría con nota", async () => {
    const cases: Case[] = [
      ["attack on titan", /^attack on titan \|/i],
      ["naruto", /^naruto \|/i],
      ["death note", /^death note \|/i],
      ["chainsaw man", /^chainsaw man \|/i],
      ["one piece", /^one piece \|/i],
      ["nana", /^nana \|/i],
      ["akira", /^akira \|/i],
      ["berserk", /^berserk \|/i],
    ];
    const r = await topHits("manga", cases, 1, 1100);
    expect(r.ratio, r.misses.join("; ")).toBeGreaterThanOrEqual(0.9);
    const page = await searchByTypePaged("one piece", "manga", 1, "es");
    const top = page.items.slice(0, 5);
    expect(top.filter((i) => typeof i.rating === "number").length / top.length).toBeGreaterThanOrEqual(0.8);
  });

  it("libros: top-1 ≥ 90 %", async () => {
    const r = await topHits(
      "book",
      [
        ["dune", /^dune|^duna/i],
        ["1984", /^1984/i],
        ["rayuela", /rayuela/i],
        ["el principito", /principito|little prince|petit prince/i],
        ["fahrenheit 451", /fahrenheit/i],
        ["el hobbit", /hobbit/i],
      ],
      1,
      1100
    );
    expect(r.ratio, r.misses.join("; ")).toBeGreaterThanOrEqual(0.9);
  });
});

describeWithKeys(["RAWG_API_KEY"], "Relevancia — juegos (RAWG)", () => {
  it("top-1 ≥ 90 %", async () => {
    const r = await topHits(
      "game",
      [
        ["hollow knight", /^hollow knight \|/i],
        ["hades", /^hades \|/i],
        ["celeste", /^celeste \|/i],
        ["minecraft", /^minecraft \|/i],
        ["baldur's gate 3", /baldur.s gate (3|iii)/i],
      ],
      1,
      300
    );
    expect(r.ratio, r.misses.join("; ")).toBeGreaterThanOrEqual(0.9);
  });
});

describeWithKeys(["COMICVINE_KEY"], "Relevancia — cómic (ComicVine, por series)", () => {
  it("serie correcta en el top-3 ≥ 80 %", async () => {
    const r = await topHits(
      "comic",
      [
        ["batman", /^batman \|/i],
        ["sandman", /sandman/i],
        ["saga", /^saga \|/i],
        ["maus", /^maus/i],
        ["v for vendetta", /v for vendetta/i],
      ],
      3,
      1100
    );
    expect(r.ratio, r.misses.join("; ")).toBeGreaterThanOrEqual(0.8);
  });
});
