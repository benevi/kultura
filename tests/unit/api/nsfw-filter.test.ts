// ============================================================
// KULTURA — Filtro NSFW global tests (E86)
// Verifica: descarta porn/hentai/erotica por título y por género; word-boundary
// (NO substring crudo: "Essex"/"Analysis" sobreviven); "adult" filtra como
// género pero NO como texto libre ("Adult Swim" sobrevive).
// ============================================================

import { describe, it, expect } from "vitest";
import {
  filterNSFW,
  isNSFW,
  NSFW_TERMS_LC,
  NSFW_GENRES_LC,
} from "@/lib/api/nsfw-filter";
import type { MediaItem } from "@/types/media";

// Helper: MediaItem mínimo con title/synopsis/genres controlables.
function item(
  id: string,
  fields: Partial<Pick<MediaItem, "title" | "synopsis" | "genres">> = {}
): MediaItem {
  return {
    id: `game_${id}`,
    externalId: id,
    type: "game",
    title: fields.title ?? id,
    synopsis: fields.synopsis,
    genres: fields.genres,
  };
}

describe("isNSFW — título inequívoco", () => {
  it("filtra términos NSFW por palabra completa", () => {
    expect(isNSFW(item("1", { title: "X mega porn pack" }))).toBe(true);
    expect(isNSFW(item("2", { title: "Erotica Vol 1" }))).toBe(true);
    expect(isNSFW(item("3", { title: "Hardcore Hentai Quest" }))).toBe(true);
    expect(isNSFW(item("4", { title: "XXX Adventures" }))).toBe(true);
    expect(isNSFW(item("5", { title: "Some +18 game" }))).toBe(true);
    expect(isNSFW(item("6", { title: "Game 18+ Edition" }))).toBe(true);
  });

  it("filtra por synopsis además del título", () => {
    expect(
      isNSFW(item("7", { title: "Innocent", synopsis: "Full of smut." }))
    ).toBe(true);
  });
});

describe("isNSFW — word-boundary, NO substring crudo", () => {
  it("NO filtra palabras que contienen un término como substring", () => {
    // "Essex" contiene "sex", "Analysis" contiene "anal" — no son términos NSFW
    // de la lista, pero confirman que NO hacemos substring de subcadenas.
    expect(isNSFW(item("8", { title: "The Essex Serpent" }))).toBe(false);
    expect(isNSFW(item("9", { title: "Analysis of Algorithms" }))).toBe(false);
    // "pornography" sí contiene "porn" como palabra-inicio... pero \b lo corta:
    // "porn" como palabra exacta no aparece en "scorpion".
    expect(isNSFW(item("10", { title: "Scorpion King" }))).toBe(false);
  });
});

describe("isNSFW — caso 'adult' (decisión documentada)", () => {
  it("NO filtra 'adult' en texto libre (falsos positivos)", () => {
    // "adult" fuera del catálogo de texto libre a propósito.
    expect(isNSFW(item("11", { title: "Adult Swim Presents" }))).toBe(false);
    expect(isNSFW(item("12", { title: "Young Adult" }))).toBe(false);
    expect(
      isNSFW(item("13", { synopsis: "Aimed at an adult audience." }))
    ).toBe(false);
  });

  it("SÍ filtra 'adult' como género/etiqueta exacta", () => {
    expect(isNSFW(item("14", { title: "Clean", genres: ["Adult"] }))).toBe(
      true
    );
  });
});

describe("isNSFW — géneros exactos", () => {
  it("filtra género NSFW (case/trim-insensitive, igualdad exacta)", () => {
    expect(isNSFW(item("15", { title: "Clean", genres: ["Hentai"] }))).toBe(
      true
    );
    expect(isNSFW(item("16", { title: "Clean", genres: [" PORN "] }))).toBe(
      true
    );
    expect(isNSFW(item("17", { title: "Clean", genres: ["Erotica"] }))).toBe(
      true
    );
  });

  it("NO filtra géneros legítimos", () => {
    expect(
      isNSFW(item("18", { title: "Clean", genres: ["Action", "Adventure"] }))
    ).toBe(false);
  });

  it("igualdad exacta: un género que solo CONTIENE el término no filtra", () => {
    // "Adult Education" como género NO es igualdad exacta de "adult".
    expect(
      isNSFW(item("19", { title: "Clean", genres: ["Adult Education"] }))
    ).toBe(false);
  });
});

describe("filterNSFW — colección", () => {
  it("descarta solo los NSFW y conserva el resto en orden", () => {
    const items = [
      item("a", { title: "Celeste" }),
      item("b", { title: "X mega porn pack" }),
      item("c", { title: "The Essex Serpent" }),
      item("d", { title: "Clean", genres: ["Hentai"] }),
      item("e", { title: "Hollow Knight" }),
    ];
    const out = filterNSFW(items);
    expect(out.map((i) => i.id)).toEqual(["game_a", "game_c", "game_e"]);
  });

  it("lista vacía → vacía", () => {
    expect(filterNSFW([])).toEqual([]);
  });
});

describe("catálogos exportados", () => {
  it("NSFW_TERMS_LC no incluye 'adult' (texto libre)", () => {
    expect((NSFW_TERMS_LC as readonly string[]).includes("adult")).toBe(false);
  });

  it("NSFW_GENRES_LC sí incluye 'adult'", () => {
    expect((NSFW_GENRES_LC as readonly string[]).includes("adult")).toBe(true);
  });
});
