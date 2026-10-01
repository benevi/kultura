// ============================================================
// KULTURA — pickShowcase (E-LANDING-SHOWCASE)
// Variedad de tipo primero, portada obligatoria, tope de tamaño.
// La carga (fetch + caché) NO se testea aquí: es `unstable_cache` sobre
// `fetchAggregateData`, ya cubierto en tests/unit/api/.
// ============================================================

import { describe, it, expect } from "vitest";
import { pickShowcase, LANDING_SHOWCASE_SIZE } from "@/lib/landing/showcase";
import type { MediaItem, MediaType } from "@/types/media";

function item(
  id: string,
  type: MediaType,
  poster: string | undefined = "https://cdn/p.jpg"
): MediaItem {
  return { id, externalId: id, type, title: `T-${id}`, poster };
}

describe("pickShowcase", () => {
  it("descarta lo que no tiene portada real", () => {
    // Ojo: `item` tiene default de poster, así que el caso "sin poster" se
    // construye a mano (pasar undefined activaría el default).
    const sinPoster: MediaItem = {
      id: "1",
      externalId: "1",
      type: "movie",
      title: "T-1",
    };
    const picked = pickShowcase([sinPoster, item("2", "book", ""), item("3", "game")]);
    expect(picked.map((p) => p.id)).toEqual(["3"]);
  });

  it("pone primero un item de cada tipo (el hero no sale con 3 películas)", () => {
    // Entrada dominada por movie: sin el reparto por tipo, el collage del hero
    // (3 piezas) se llevaría tres películas seguidas.
    // Tamaño explícito: aquí se comprueba el ORDEN, no el tope (que por
    // defecto es LANDING_SHOWCASE_SIZE = lo que consume el hero).
    const picked = pickShowcase(
      [
        item("m1", "movie"),
        item("m2", "movie"),
        item("m3", "movie"),
        item("b1", "book"),
        item("g1", "game"),
      ],
      5
    );
    expect(picked.slice(0, 3).map((p) => p.type)).toEqual([
      "movie",
      "book",
      "game",
    ]);
    // El resto se conserva detrás, sin perder items.
    expect(picked.map((p) => p.id)).toEqual(["m1", "b1", "g1", "m2", "m3"]);
  });

  it("respeta el tope de tamaño", () => {
    const many = Array.from({ length: 30 }, (_, i) => item(`i${i}`, "movie"));
    expect(pickShowcase(many)).toHaveLength(LANDING_SHOWCASE_SIZE);
    expect(pickShowcase(many, 3)).toHaveLength(3);
  });

  it("devuelve solo los campos que la landing pinta", () => {
    const [picked] = pickShowcase([item("x", "comic")]);
    expect(picked).toEqual({
      id: "x",
      title: "T-x",
      type: "comic",
      poster: "https://cdn/p.jpg",
    });
  });

  it("lista vacía → muestra vacía (la landing cae a gradientes)", () => {
    expect(pickShowcase([])).toEqual([]);
  });
});
