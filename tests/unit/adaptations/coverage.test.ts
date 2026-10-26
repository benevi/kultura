// ============================================================
// F-29 · Aceptación: 50 títulos con adaptaciones conocidas
//
// Respuestas REALES de Wikidata grabadas el 2026-10-26 con
// `fixtures/record.mjs` (la misma consulta que usa la app); el test no sale a
// la red. Para cada título se sabe de antemano qué obra tiene que aparecer en
// "También existe como…" (formato + título, `fixtures/cases.json`, elegido a
// mano, no sacado de Wikidata). Criterio: ≥ 70 % (35 de 50).
// El paso que necesita otra API (edición de Open Library → obra, slug de
// RAWG → id) se simula resolviendo a un id con forma válida: aquí se mide el
// vínculo, no esas dos APIs (tienen su test en load.test.ts).
// ============================================================

import { describe, it, expect } from "vitest";
import cases from "./fixtures/cases.json";
import responses from "./fixtures/wikidata-responses.json";
import { parseAdaptationsResponse } from "@/lib/api/wikidata";
import { buildView, pendingRefs, toStored } from "@/lib/adaptations/model";

interface Case {
  mediaId: string;
  title: string;
  expect: { type: string; label: string };
}

const RESPONSES = responses as unknown as Record<string, unknown>;

function resolveFake(parsed: ReturnType<typeof parseAdaptationsResponse>) {
  const map = new Map<string, string>();
  pendingRefs(parsed).forEach((p, i) => {
    map.set(p.key, p.kind === "rawg" ? `game_${900000 + i}` : `book_${p.value.replace(/M$/, "W")}`);
  });
  return map;
}

function linked(c: Case, locale: string): boolean {
  const parsed = parseAdaptationsResponse(RESPONSES[c.mediaId]);
  const view = buildView(toStored(parsed, c.mediaId, resolveFake(parsed)), c.mediaId, locale);
  const re = new RegExp(c.expect.label, "i");
  return view.alsoAs.some((l) => l.type === c.expect.type && re.test(l.title));
}

describe("vínculos de adaptación con respuestas grabadas de Wikidata", () => {
  const all = cases as Case[];

  it("hay 50 casos y una respuesta grabada por caso", () => {
    expect(all).toHaveLength(50);
    for (const c of all) expect(RESPONSES, c.mediaId).toHaveProperty(c.mediaId);
  });

  it("≥ 70 % muestran el vínculo correcto (en inglés)", () => {
    const ok = all.filter((c) => linked(c, "en"));
    // Hoy: 47/50. Fallan Shawshank (la novela corta no tiene id de Open
    // Library), Psicosis (Wikidata no le pone P144) y El hobbit (id de prueba
    // que Wikidata no tiene).
    expect(ok.length / all.length).toBeGreaterThanOrEqual(0.7);
    expect(ok.length).toBeGreaterThanOrEqual(45);
  });

  it("≥ 70 % también con las etiquetas en español", () => {
    expect(all.filter((c) => linked(c, "es")).length / all.length).toBeGreaterThanOrEqual(0.7);
  });

  it("nunca se enlaza a sí mismo y no repite títulos", () => {
    for (const c of all) {
      const parsed = parseAdaptationsResponse(RESPONSES[c.mediaId]);
      const view = buildView(toStored(parsed, c.mediaId, resolveFake(parsed)), c.mediaId, "es");
      const ids = view.alsoAs.map((l) => l.mediaId);
      expect(ids, c.mediaId).not.toContain(c.mediaId);
      expect(new Set(ids).size, c.mediaId).toBe(ids.length);
    }
  });

  it("Dune (2021): la novela como origen y la de 1984 como otra adaptación; franquicia Dune", () => {
    const parsed = parseAdaptationsResponse(RESPONSES["movie_438631"]);
    const view = buildView(toStored(parsed, "movie_438631"), "movie_438631", "es");
    expect(view.alsoAs[0]).toMatchObject({ type: "book", rel: "source", title: "Dune" });
    expect(view.alsoAs.some((l) => l.mediaId === "movie_841")).toBe(true);
    expect(view.franchise?.name).toMatch(/Dune/);
    expect(view.franchise!.members.length).toBeGreaterThanOrEqual(2);
  });
});
