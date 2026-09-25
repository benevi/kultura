// ============================================================
// KULTURA — anilist-maps.ts unit tests (E-ANIME-SOURCE)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildAniListDiscoverParams,
  aniListDateRange,
  aniListTodayBound,
  ANILIST_GENRE,
  ANILIST_STATUS,
} from "@/lib/api/anilist-maps";

describe("buildAniListDiscoverParams", () => {
  it("sin filtros → sort default popularity + tope de hoy", () => {
    expect(buildAniListDiscoverParams({})).toEqual({
      genre_in: undefined,
      status: undefined,
      startDate_greater: undefined,
      // E-CATALOGO-FUTURO: tope incondicional — sin él, START_DATE_DESC abre
      // por anime que aún no ha empezado a emitirse.
      startDate_lesser: aniListTodayBound(),
      sort: ["POPULARITY_DESC"],
      averageScore_greater: undefined,
    });
  });

  it("genre: traduce slugs canónicos a nombres literales de AniList", () => {
    const params = buildAniListDiscoverParams({ genre: ["accion", "drama"] });
    expect(params.genre_in).toEqual([ANILIST_GENRE.accion, ANILIST_GENRE.drama]);
  });

  it("genre desconocido → se omite sin romper la query", () => {
    const params = buildAniListDiscoverParams({ genre: ["no-existe"] });
    expect(params.genre_in).toBeUndefined();
  });

  it("status: airing → RELEASING, complete → FINISHED, upcoming → NOT_YET_RELEASED", () => {
    expect(buildAniListDiscoverParams({ status: "airing" }).status).toBe(
      ANILIST_STATUS.airing
    );
    expect(buildAniListDiscoverParams({ status: "complete" }).status).toBe(
      "FINISHED"
    );
    expect(buildAniListDiscoverParams({ status: "upcoming" }).status).toBe(
      "NOT_YET_RELEASED"
    );
  });

  it("status desconocido → se omite", () => {
    expect(
      buildAniListDiscoverParams({ status: "hiatus" }).status
    ).toBeUndefined();
  });

  it("sort: rating/release_desc/release_asc/title_az/title_za", () => {
    expect(buildAniListDiscoverParams({ sort: "rating" }).sort).toEqual([
      "SCORE_DESC",
    ]);
    expect(buildAniListDiscoverParams({ sort: "release_desc" }).sort).toEqual([
      "START_DATE_DESC",
    ]);
    expect(buildAniListDiscoverParams({ sort: "release_asc" }).sort).toEqual([
      "START_DATE",
    ]);
    expect(buildAniListDiscoverParams({ sort: "title_az" }).sort).toEqual([
      "TITLE_ROMAJI",
    ]);
    expect(buildAniListDiscoverParams({ sort: "title_za" }).sort).toEqual([
      "TITLE_ROMAJI_DESC",
    ]);
  });

  it("sort desconocido → popularity default", () => {
    expect(buildAniListDiscoverParams({ sort: "zzz" }).sort).toEqual([
      "POPULARITY_DESC",
    ]);
  });

  it("valoracion: umbral*10 - 1 (AniList 0-100, solo '_greater' estricto)", () => {
    expect(buildAniListDiscoverParams({ valoracion: "8" }).averageScore_greater).toBe(
      79
    );
    expect(buildAniListDiscoverParams({ valoracion: "9" }).averageScore_greater).toBe(
      89
    );
  });

  it("valoracion desconocida/vacía → se omite", () => {
    expect(
      buildAniListDiscoverParams({ valoracion: "99" }).averageScore_greater
    ).toBeUndefined();
    expect(buildAniListDiscoverParams({}).averageScore_greater).toBeUndefined();
  });

  it("year: año exacto → rango de 1 año", () => {
    const p = buildAniListDiscoverParams({ year: "2024" });
    expect(p.startDate_greater).toBe(20231231);
    expect(p.startDate_lesser).toBe(20250101);
  });

  it("year: década → rango de 10 años", () => {
    const p = buildAniListDiscoverParams({ year: "2010s" });
    expect(p.startDate_greater).toBe(20091231);
    expect(p.startDate_lesser).toBe(20200101);
  });

  it("year: 'classic' → 1900-1999", () => {
    const p = buildAniListDiscoverParams({ year: "classic" });
    expect(p.startDate_greater).toBe(18991231);
    expect(p.startDate_lesser).toBe(20000101);
  });

  it("year inválido → sin rango, pero con el tope de hoy", () => {
    const p = buildAniListDiscoverParams({ year: "nope" });
    expect(p.startDate_greater).toBeUndefined();
    expect(p.startDate_lesser).toBe(aniListTodayBound());
  });

  // ── E-CATALOGO-FUTURO ──────────────────────────────────────────────────────

  it("año en curso → el tope superior se recorta a hoy", () => {
    const yearNow = new Date().getUTCFullYear();
    const p = buildAniListDiscoverParams({ year: String(yearNow) });
    expect(p.startDate_greater).toBe((yearNow - 1) * 10000 + 1231);
    expect(p.startDate_lesser).toBe(aniListTodayBound());
  });

  it("estado=upcoming NO lleva tope: el futuro es lo que se pide", () => {
    const p = buildAniListDiscoverParams({ status: "upcoming" });
    expect(p.status).toBe("NOT_YET_RELEASED");
    expect(p.startDate_lesser).toBeUndefined();
  });

  it("otros estados sí llevan tope", () => {
    const p = buildAniListDiscoverParams({ status: "airing" });
    expect(p.startDate_lesser).toBe(aniListTodayBound());
  });

  it("año futuro explícito se respeta sin recortar", () => {
    const p = buildAniListDiscoverParams({ year: "2099" });
    expect(p.startDate_greater).toBe(20981231);
    expect(p.startDate_lesser).toBe(21000101);
  });

  it("aniListTodayBound: entero de hoy + 1 (cota exclusiva)", () => {
    expect(aniListTodayBound(new Date("2026-09-25T10:00:00Z"))).toBe(20260926);
    // Fin de mes: el día inexistente es intencionado — AniList compara el
    // FuzzyDateInt como número, y 20260931 cae entre el 30/09 y el 01/10.
    expect(aniListTodayBound(new Date("2026-09-30T10:00:00Z"))).toBe(20260931);
  });
});

describe("aniListDateRange", () => {
  it("vacío/null → null", () => {
    expect(aniListDateRange(null)).toBeNull();
    expect(aniListDateRange(undefined)).toBeNull();
    expect(aniListDateRange("")).toBeNull();
  });
});
