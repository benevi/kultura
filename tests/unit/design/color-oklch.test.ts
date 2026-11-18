/**
 * @vitest-environment node
 *
 * Tests unitarios — sRGB ↔ OKLCH y «ajustar luminosidad hasta cumplir contraste».
 *
 * Son las piezas con las que la paleta de cada obra cumple AA (biblia, §4).
 * El contraste de los tokens fijos del sistema lo prueba `contrast.test.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  ensureContrast,
  oklchToSrgb,
  oklchToSrgbInGamut,
  parseHex,
  srgbToOklab,
  srgbToOklch,
  toHex,
  type Rgb,
} from "@/lib/design/color";

const rgb = (hex: string) => parseHex(hex) as Rgb;

describe("sRGB → OKLab / OKLCH", () => {
  it("valores de referencia (CSS Color 4)", () => {
    expect(srgbToOklch(rgb("#ffffff")).l).toBeCloseTo(1, 4);
    expect(srgbToOklch(rgb("#ffffff")).c).toBeCloseTo(0, 4);
    expect(srgbToOklch(rgb("#000000"))).toEqual({ l: 0, c: 0, h: 0 });
    const red = srgbToOklch(rgb("#ff0000"));
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const blue = srgbToOklch(rgb("#0000ff"));
    expect(blue.l).toBeCloseTo(0.452, 3);
    expect(blue.h).toBeCloseTo(264.05, 1);
    const [l, a, b] = srgbToOklab(rgb("#00ff00"));
    expect(l).toBeCloseTo(0.8664, 3);
    expect(a).toBeCloseTo(-0.2339, 3);
    expect(b).toBeCloseTo(0.1795, 3);
  });

  it("un gris no tiene croma y su matiz es 0, no un ángulo al azar", () => {
    const gray = srgbToOklch(rgb("#808080"));
    expect(gray.c).toBeLessThan(1e-4);
    expect(gray.h).toBeGreaterThanOrEqual(0);
    expect(gray.h).toBeLessThan(360);
  });

  it("ida y vuelta: cualquier #rrggbb vuelve a ser el mismo", () => {
    for (const hex of ["#000000", "#ffffff", "#e6e3dd", "#171614", "#ff0000", "#00ff00", "#0000ff", "#12ab9c", "#fedcba", "#7f007f"]) {
      expect(toHex(oklchToSrgb(srgbToOklch(rgb(hex))))).toBe(hex);
      expect(toHex(oklchToSrgbInGamut(srgbToOklch(rgb(hex))))).toBe(hex);
    }
  });
});

describe("oklchToSrgbInGamut", () => {
  it("un color que no cabe en sRGB pierde croma, no luminosidad ni matiz", () => {
    for (const color of [
      { l: 0.7, c: 0.4, h: 150 },
      { l: 0.5, c: 0.37, h: 30 },
      { l: 0.9, c: 0.3, h: 270 },
      { l: 0.3, c: 0.3, h: 100 },
    ]) {
      const out = oklchToSrgbInGamut(color);
      for (const channel of out) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
      const back = srgbToOklch(out);
      expect(Math.abs(back.l - color.l)).toBeLessThan(0.005);
      expect(back.c).toBeLessThan(color.c);
      const delta = Math.abs(back.h - color.h);
      expect(Math.min(delta, 360 - delta)).toBeLessThan(3);
    }
  });

  it("devuelve canales de 8 bits: el contraste calculado es el del hex que se pinta", () => {
    const out = oklchToSrgbInGamut({ l: 0.613, c: 0.11, h: 222 });
    for (const channel of out) expect(Number.isInteger(Math.round(channel * 255 * 1e6) / 1e6)).toBe(true);
    expect(contrastRatio(out, [1, 1, 1])).toBe(contrastRatio(rgb(toHex(out)), [1, 1, 1]));
  });

  it("la luminosidad se acota a 0-1", () => {
    expect(toHex(oklchToSrgbInGamut({ l: 1.4, c: 0, h: 0 }))).toBe("#ffffff");
    expect(toHex(oklchToSrgbInGamut({ l: -0.2, c: 0.1, h: 40 }))).toBe("#000000");
  });
});

describe("ensureContrast", () => {
  const light = rgb("#e6e3dd");
  const dark = rgb("#171614");

  it("oscurece sobre fondo claro y aclara sobre oscuro hasta llegar al mínimo", () => {
    for (const ratio of [3, 4.5, 7]) {
      const onLight = ensureContrast({ l: 0.8, c: 0.1, h: 30 }, [light], ratio, "darker");
      expect(contrastRatio(onLight, light)).toBeGreaterThanOrEqual(ratio);
      const onDark = ensureContrast({ l: 0.3, c: 0.1, h: 30 }, [dark], ratio, "lighter");
      expect(contrastRatio(onDark, dark)).toBeGreaterThanOrEqual(ratio);
    }
  });

  it("se queda en el primer paso que cumple: no oscurece de más", () => {
    const out = ensureContrast({ l: 0.8, c: 0.1, h: 30 }, [light], 4.5, "darker");
    expect(contrastRatio(out, light)).toBeLessThan(4.8);
    // Conserva el matiz.
    expect(Math.abs(srgbToOklch(out).h - 30)).toBeLessThan(4);
  });

  it("si el color de partida ya cumple, lo devuelve tal cual", () => {
    const start = { l: 0.2, c: 0.03, h: 80 };
    expect(ensureContrast(start, [light], 7, "darker")).toEqual(oklchToSrgbInGamut(start));
  });

  it("cumple contra todos los fondos a la vez", () => {
    const panel = rgb("#d8d4cc");
    const out = ensureContrast({ l: 0.6, c: 0.03, h: 80 }, [light, panel], 4.5, "darker");
    expect(contrastRatio(out, light)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out, panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("siempre termina: si no se puede, devuelve el extremo de esa dirección", () => {
    expect(ensureContrast({ l: 0.5, c: 0.1, h: 30 }, [[0, 0, 0]], 4.5, "darker")).toEqual([0, 0, 0]);
    expect(ensureContrast({ l: 0.9, c: 0.1, h: 30 }, [[1, 1, 1]], 4.5, "lighter")).toEqual([1, 1, 1]);
    expect(ensureContrast({ l: 0.5, c: 0.1, h: 30 }, [light], 25, "darker")).toEqual([0, 0, 0]);
  });
});
