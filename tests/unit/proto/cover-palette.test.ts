// Comprobación del contraste de la paleta con portadas al azar (rama de prototipo).
import { describe, expect, it } from "vitest";
import { contrast, type RGB } from "@/app/[locale]/proto/ficha/_base/color";
import { derivePalette, extractSwatches, type ThemeTokens } from "@/app/[locale]/proto/ficha/_base/cover-palette";

const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

function check(t: ThemeTokens) {
  for (const b of [rgb(t.bg), rgb(t.surface)]) {
    expect(contrast(rgb(t.ink), b)).toBeGreaterThanOrEqual(7);
    expect(contrast(rgb(t.ink2), b)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(t.accent), b)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(t.edge), b)).toBeGreaterThanOrEqual(3);
  }
  expect(contrast(rgb(t.accentInk), rgb(t.accent))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(rgb(t.fieldInk), rgb(t.field))).toBeGreaterThanOrEqual(4.5);
}

describe("paleta de portada", () => {
  it("cumple AA con 3000 portadas al azar, en claro y en oscuro", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let n = 0; n < 3000; n++) {
      const cols = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
      const data: number[] = [];
      for (let i = 0; i < 400; i++) {
        const c = cols[Math.floor(rnd() * rnd() * cols.length)];
        data.push(c[0], c[1], c[2], 255);
      }
      const p = derivePalette(extractSwatches(data));
      check(p.light);
      check(p.dark);
    }
  });

  it("blanco, negro, gris y vacío dan paleta neutra y legible", () => {
    for (const v of [255, 0, 128]) {
      const p = derivePalette(extractSwatches(Array.from({ length: 400 }, () => [v, v, v, 255]).flat()));
      expect(p.neutral).toBe(true);
      check(p.light);
      check(p.dark);
    }
    const empty = derivePalette([]);
    check(empty.light);
    check(empty.dark);
  });
});
