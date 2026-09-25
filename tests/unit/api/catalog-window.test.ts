// ============================================================
// KULTURA — Ventana de catálogo (E-CATALOGO-FUTURO)
// La regla vive aquí; cada proveedor la aplica con su operador nativo y tiene
// sus propios tests (rawg-maps, tmdb-maps, anilist-maps, comicvine-maps,
// openlibrary-maps). Esto cubre el helper compartido.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  todayIso,
  todayYear,
  clampRangeToToday,
  dropFutureYears,
} from "@/lib/api/catalog-window";
import type { MediaItem } from "@/types/media";

const HOY = new Date("2026-09-25T10:00:00Z");

describe("todayIso / todayYear", () => {
  it("formatea en UTC, sin depender del huso de la máquina", () => {
    expect(todayIso(HOY)).toBe("2026-09-25");
    expect(todayYear(HOY)).toBe(2026);
    // 23:30 UTC sigue siendo el mismo día en UTC.
    expect(todayIso(new Date("2026-09-25T23:30:00Z"))).toBe("2026-09-25");
  });
});

describe("clampRangeToToday", () => {
  it("recorta el extremo superior cuando cae en el futuro", () => {
    expect(clampRangeToToday("2020-01-01", "2029-12-31", HOY)).toEqual({
      start: "2020-01-01",
      end: "2026-09-25",
    });
  });

  it("deja intacto un rango enteramente pasado", () => {
    expect(clampRangeToToday("2000-01-01", "2009-12-31", HOY)).toEqual({
      start: "2000-01-01",
      end: "2009-12-31",
    });
  });

  it("respeta un rango que EMPIEZA en el futuro (no invierte la ventana)", () => {
    // Recortarlo daría inicio > fin, es decir, catálogo vacío en vez de filtro.
    expect(clampRangeToToday("2099-01-01", "2099-12-31", HOY)).toEqual({
      start: "2099-01-01",
      end: "2099-12-31",
    });
  });

  it("un rango que termina hoy no se toca", () => {
    expect(clampRangeToToday("2026-01-01", "2026-09-25", HOY).end).toBe(
      "2026-09-25"
    );
  });
});

describe("dropFutureYears", () => {
  const item = (id: string, year?: number) =>
    ({ id, externalId: id, type: "manga", title: id, year } as MediaItem);

  it("descarta lo publicado por delante del año en curso", () => {
    const items = [item("a", 2024), item("b", 2026), item("c", 2030)];
    expect(dropFutureYears(items, HOY).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("conserva los items SIN año: no sabemos que mientan", () => {
    const items = [item("sin-año"), item("futuro", 2031)];
    expect(dropFutureYears(items, HOY).map((i) => i.id)).toEqual(["sin-año"]);
  });

  it("lista vacía → lista vacía (nunca lanza)", () => {
    expect(dropFutureYears([], HOY)).toEqual([]);
  });
});
