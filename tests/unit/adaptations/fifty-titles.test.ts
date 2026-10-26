// ============================================================
// F-29 · Aceptación de PRO-11: ≥ 70 % de 50 títulos con adaptaciones
// conocidas muestran el vínculo correcto.
//
// `fixtures/*.json` son respuestas REALES de Wikidata (WDQS, 2026-10-26) a la
// consulta de `buildAdaptationsQuery`, capturadas con el User-Agent del
// proyecto (desde aquí el proxy de la app no llega a Wikidata; la captura se
// hizo aparte). `fixtures/titles.json` lista los 50 títulos con su id en
// KULTURA y el vínculo esperado (formato + nombre de la obra relacionada).
// Si la consulta cambia, hay que volver a capturar: el test comprueba que la
// consulta guardada en cada fixture sigue siendo la de hoy.
// El guion `check-production.mjs` repite la comprobación contra producción.
// ============================================================

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { mapAdaptations } from "@/lib/adaptations/map";
import { buildAdaptationsQuery, subjectClaims, type SparqlResults } from "@/lib/api/wikidata";
import type { MediaType } from "@/types/media";

interface Title {
  slug: string;
  type: string;
  externalId: string;
  value: string;
  malId?: number;
  /** Número de RAWG del juego (la ficha de producción). */
  kulturaId?: string;
  expect: { type: string; label: string };
  fixture: string;
  queryHash: string;
}

const DIR = path.join(__dirname, "fixtures");
const titles = JSON.parse(readFileSync(path.join(DIR, "titles.json"), "utf8")) as Title[];

function check(t: Title) {
  const res = JSON.parse(readFileSync(path.join(DIR, t.fixture), "utf8")) as SparqlResults;
  const subject = t.type === "game" ? "game_0" : `${t.type}_${t.externalId}`;
  const links = mapAdaptations(res.results.bindings, subject);
  const re = new RegExp(t.expect.label, "i");
  const hit = links.find((l) => l.type === t.expect.type && [l.labels.en, l.labels.es].some((x) => x && re.test(x)));
  return { links, hit };
}

describe("50 títulos de prueba (fixtures reales de Wikidata)", () => {
  it("cada fixture responde a la consulta que hace hoy la ficha (si cambia, recapturar)", () => {
    for (const t of titles) {
      const claims =
        t.type === "game"
          ? subjectClaims("game", t.kulturaId ?? "1", { rawgSlug: t.value })
          : subjectClaims(t.type as MediaType, t.externalId, { malId: t.malId });
      const hash = createHash("sha256").update(buildAdaptationsQuery(claims)).digest("hex").slice(0, 16);
      expect(hash, t.slug).toBe(t.queryHash);
    }
  });

  it("son 50, de todos los formatos que tienen id en Wikidata", () => {
    expect(titles).toHaveLength(50);
    expect(new Set(titles.map((t) => t.type))).toEqual(new Set(["movie", "tv", "anime", "manga", "book", "game"]));
    expect(new Set(titles.map((t) => t.slug)).size).toBe(50);
  });

  it("≥ 70 % muestran el vínculo esperado (hoy 45/50)", () => {
    const hits = titles.filter((t) => check(t).hit);
    const misses = titles.filter((t) => !check(t).hit).map((t) => t.slug);
    expect(hits.length / titles.length).toBeGreaterThanOrEqual(0.7);
    // Guardia de regresión: el mapeo no puede empeorar lo ya conseguido.
    expect(hits.length, `fallan: ${misses.join(", ")}`).toBeGreaterThanOrEqual(45);
  });

  it.each([
    ["dune-2021", "book_OL893415W"], // la novela (de sus dos obras en Open Library, la menor: determinista)
    ["the-witcher-tv", "book_OL2577485W"], // El último deseo (libro de la saga)
    ["attack-on-titan", "manga_al-53390"], // temporada 1 → serie → manga
    ["the-hobbit", "movie_1362"],
    ["one-piece-2023", "manga_al-30013"],
  ])("%s enlaza %s", (slug, mediaId) => {
    const t = titles.find((x) => x.slug === slug)!;
    expect(check(t).links.map((l) => l.mediaId)).toContain(mediaId);
  });

  it("Arcane y The Last of Us (serie) llevan a su juego (slug de RAWG, se resuelve aparte)", () => {
    for (const [slug, rawg] of [
      ["arcane", "league-of-legends"],
      ["the-last-of-us-tv", "the-last-of-us"],
    ]) {
      const t = titles.find((x) => x.slug === slug)!;
      expect(check(t).links.map((l) => l.rawgSlug)).toContain(rawg);
    }
  });

  it("ningún vínculo apunta al propio título", () => {
    for (const t of titles) {
      if (t.type === "game") continue;
      expect(check(t).links.map((l) => l.mediaId)).not.toContain(`${t.type}_${t.externalId}`);
    }
  });
});
