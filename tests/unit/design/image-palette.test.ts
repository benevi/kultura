/**
 * @vitest-environment node
 *
 * Tests unitarios — paleta sacada de la imagen de una obra (biblia de diseño, §4).
 *
 * El color de la ficha sale de una imagen cualquiera, así que el contraste no
 * se puede mirar obra a obra: se prueba con 3000 portadas sintéticas al azar
 * (semilla fija: siempre las mismas) y con los casos borde. Para cada una, en
 * claro y en oscuro:
 * - todo par texto/fondo ≥ 4,5:1 (la tinta principal, ≥ 7:1);
 * - el borde de componente ≥ 3:1;
 * - la franja, el fondo y el panel, en la luminosidad OKLCH que fija la biblia.
 * Todo se mide sobre los `#rrggbb` que salen, que es lo que se pinta.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio, parseHex, srgbToOklch, type Rgb } from "@/lib/design/color";
import {
  BACKGROUND_LIGHTNESS,
  BAND_LIGHTNESS,
  COMPONENT_CONTRAST,
  NEUTRAL_BASE,
  NEUTRAL_PALETTE,
  PANEL_LIGHTNESS_STEP,
  PRIMARY_INK_CONTRAST,
  TEXT_CONTRAST,
  extractSwatches,
  paletteFromPixels,
  paletteFromSwatches,
  type ImagePalette,
  type ThemePalette,
} from "@/lib/design/image-palette";

const rgb = (hex: string): Rgb => {
  const out = parseHex(hex);
  if (!out) throw new Error(`No es un hex: ${hex}`);
  return out;
};
const ratio = (a: string, b: string) => contrastRatio(rgb(a), rgb(b));
const lightness = (hex: string) => srgbToOklch(rgb(hex)).l;
const MODES = ["light", "dark"] as const;

/** Los pares que la biblia obliga a cumplir, con su mínimo. */
function pairs(t: ThemePalette): Array<[name: string, value: number, min: number]> {
  const out: Array<[string, number, number]> = [];
  for (const [surface, hex] of [["fondo", t.background], ["panel", t.panel]] as const) {
    out.push([`tinta sobre ${surface}`, ratio(t.ink, hex), PRIMARY_INK_CONTRAST]);
    out.push([`tinta secundaria sobre ${surface}`, ratio(t.inkSecondary, hex), TEXT_CONTRAST]);
    out.push([`acento sobre ${surface}`, ratio(t.accent, hex), TEXT_CONTRAST]);
    out.push([`borde sobre ${surface}`, ratio(t.border, hex), COMPONENT_CONTRAST]);
  }
  out.push(["texto sobre acento", ratio(t.accentInk, t.accent), TEXT_CONTRAST]);
  out.push(["texto sobre franja", ratio(t.bandInk, t.band), TEXT_CONTRAST]);
  return out;
}

/** Fallos de una paleta (vacío = cumple), en texto: así el fallo dice qué portada y qué par. */
function failures(p: ImagePalette): string[] {
  const out: string[] = [];
  for (const mode of MODES) {
    const t = p[mode];
    for (const value of Object.values(t)) {
      if (!/^#[0-9a-f]{6}$/.test(value)) out.push(`${mode}: ${value} no es #rrggbb`);
    }
    for (const [name, value, min] of pairs(t)) {
      if (!(value >= min)) out.push(`${mode}: ${name} = ${value.toFixed(2)} (< ${min})`);
    }
    const band = lightness(t.band);
    const range = BAND_LIGHTNESS[mode];
    if (!(band >= range.min && band <= range.max)) {
      out.push(`${mode}: franja L ${band.toFixed(4)} fuera de ${range.min}–${range.max}`);
    }
  }
  return out;
}

/** Generador con semilla (mulberry32): las mismas portadas en cada ejecución. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIXELS = 400; // 20 × 20, como el canvas pequeño de donde se lee

/**
 * Una portada sintética: 1–5 colores al azar repartidos de forma desigual.
 * Una de cada cuatro lleva ruido por píxel (foto, no tinta plana), una de cada
 * cinco es casi gris y una de cada diez tiene una parte transparente.
 */
function randomCover(rnd: () => number): number[] {
  const muted = rnd() < 0.2;
  const noisy = rnd() < 0.25;
  const holes = rnd() < 0.1;
  const colors = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
    if (!muted) return [rnd() * 255, rnd() * 255, rnd() * 255];
    const base = rnd() * 255;
    return [base + (rnd() - 0.5) * 24, base + (rnd() - 0.5) * 24, base + (rnd() - 0.5) * 24];
  });
  const jitter = () => (noisy ? (rnd() - 0.5) * 40 : 0);
  const data: number[] = [];
  for (let i = 0; i < PIXELS; i++) {
    const c = colors[Math.floor(rnd() * rnd() * colors.length)];
    data.push(c[0] + jitter(), c[1] + jitter(), c[2] + jitter(), holes && rnd() < 0.4 ? 0 : 255);
  }
  return data;
}

/** `count` píxeles de un color. */
const flat = (r: number, g: number, b: number, a = 255, count = PIXELS) =>
  Array.from({ length: count }, () => [r, g, b, a]).flat();

describe("paleta de la imagen: 3000 portadas al azar", () => {
  it("cumple contraste y rangos de luminosidad en claro y en oscuro", () => {
    const rnd = seeded(84);
    const bad: string[] = [];
    let colored = 0;
    for (let n = 0; n < 3000; n++) {
      const palette = paletteFromPixels(randomCover(rnd));
      if (!palette.neutral) colored++;
      for (const f of failures(palette)) bad.push(`portada ${n}: ${f}`);
    }
    expect(bad).toEqual([]);
    // La prueba no vale si casi todo cae en la neutra.
    expect(colored).toBeGreaterThan(2000);
  });

  it("el fondo y el panel de una paleta con color van en la luminosidad de la biblia", () => {
    const rnd = seeded(2026);
    let checked = 0;
    for (let n = 0; n < 300; n++) {
      const palette = paletteFromPixels(randomCover(rnd));
      if (palette.neutral) continue;
      checked++;
      for (const mode of MODES) {
        // Margen de 0,004: el redondeo a 8 bits por canal.
        expect(Math.abs(lightness(palette[mode].background) - BACKGROUND_LIGHTNESS[mode])).toBeLessThan(0.004);
        const panel = BACKGROUND_LIGHTNESS[mode] + PANEL_LIGHTNESS_STEP[mode];
        expect(Math.abs(lightness(palette[mode].panel) - panel)).toBeLessThan(0.004);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("es una función pura: los mismos píxeles dan la misma paleta", () => {
    const cover = randomCover(seeded(5)).map((v) => Math.min(255, Math.max(0, Math.round(v))));
    expect(paletteFromPixels(cover)).toEqual(paletteFromPixels(cover));
    expect(paletteFromPixels(new Uint8ClampedArray(cover))).toEqual(paletteFromPixels(cover));
  });
});

describe("paleta de la imagen: casos borde", () => {
  it.each([
    ["negra", flat(0, 0, 0)],
    ["blanca", flat(255, 255, 255)],
    ["gris", flat(128, 128, 128)],
    ["transparente", flat(200, 30, 30, 0)],
    ["vacía", []],
    ["a medias (menos de un píxel)", [255, 0, 0]],
    ["con valores que no son números", Array.from({ length: PIXELS * 4 }, () => NaN)],
  ])("imagen %s → paleta neutra", (_name, data) => {
    expect(paletteFromPixels(data)).toBe(NEUTRAL_PALETTE);
  });

  it("imagen que no se pudo leer → paleta neutra", () => {
    expect(paletteFromPixels(null)).toBe(NEUTRAL_PALETTE);
    expect(paletteFromPixels(undefined)).toBe(NEUTRAL_PALETTE);
    expect(paletteFromSwatches([])).toBe(NEUTRAL_PALETTE);
  });

  it("la neutra lleva los colores de la biblia y cumple", () => {
    expect(NEUTRAL_PALETTE.neutral).toBe(true);
    expect(NEUTRAL_PALETTE.light.background).toBe("#e6e3dd");
    expect(NEUTRAL_PALETTE.light.ink).toBe("#1b1a17");
    expect(NEUTRAL_PALETTE.dark.background).toBe("#171614");
    expect(NEUTRAL_PALETTE.dark.ink).toBe("#f2f0eb");
    expect(NEUTRAL_BASE.light.background).toBe(NEUTRAL_PALETTE.light.background);
    expect(failures(NEUTRAL_PALETTE)).toEqual([]);
    // El panel es un paso sobre el fondo, no el mismo color.
    for (const mode of MODES) {
      const step = lightness(NEUTRAL_PALETTE[mode].panel) - lightness(NEUTRAL_PALETTE[mode].background);
      expect(Math.abs(step - PANEL_LIGHTNESS_STEP[mode])).toBeLessThan(0.004);
    }
  });

  it.each([
    ["rojo", [255, 0, 0]],
    ["verde", [0, 255, 0]],
    ["azul", [0, 0, 255]],
    ["amarillo", [255, 255, 0]],
    ["magenta", [255, 0, 255]],
    ["cian", [0, 255, 255]],
    ["azul oscuro", [20, 20, 110]],
    ["rosa pálido", [240, 200, 200]],
  ])("un solo color (%s) da paleta con color y cumple", (_name, [r, g, b]) => {
    const palette = paletteFromPixels(flat(r, g, b));
    expect(palette.neutral).toBe(false);
    expect(failures(palette)).toEqual([]);
    // La franja conserva el matiz de la imagen (±12°).
    const hue = srgbToOklch([r / 255, g / 255, b / 255]).h;
    for (const mode of MODES) {
      const delta = Math.abs(srgbToOklch(rgb(palette[mode].band)).h - hue);
      expect(Math.min(delta, 360 - delta)).toBeLessThan(12);
    }
  });

  it("un papel crema, casi blanco, no es un color: neutra", () => {
    expect(paletteFromPixels(flat(250, 244, 226)).neutral).toBe(true);
  });

  it("un punto de color en una imagen gris no basta; una mancha sí", () => {
    const speck = [...flat(255, 0, 0, 255, 4), ...flat(128, 128, 128, 255, 396)]; // 1 %
    expect(paletteFromPixels(speck).neutral).toBe(true);
    const patch = [...flat(255, 0, 0, 255, 40), ...flat(128, 128, 128, 255, 360)]; // 10 %
    expect(paletteFromPixels(patch).neutral).toBe(false);
  });

  it("los píxeles transparentes no cuentan", () => {
    const half = [...flat(0, 90, 200, 255, 200), ...flat(255, 0, 0, 0, 200)];
    expect(paletteFromPixels(half)).toEqual(paletteFromPixels(flat(0, 90, 200)));
  });
});

describe("extractSwatches", () => {
  it("ordena por presencia y da la parte que ocupa cada color", () => {
    const swatches = extractSwatches([...flat(20, 40, 160, 255, 100), ...flat(200, 30, 30, 255, 300)]);
    expect(swatches).toHaveLength(2);
    expect(swatches[0].share).toBeCloseTo(0.75, 5);
    expect(swatches[1].share).toBeCloseTo(0.25, 5);
    expect(swatches[0].rgb[0]).toBeCloseTo(200 / 255, 5);
  });

  it("junta colores casi iguales y respeta el máximo", () => {
    expect(extractSwatches([...flat(200, 30, 30, 255, 200), ...flat(204, 34, 28, 255, 200)])).toHaveLength(1);
    const rnd = seeded(11);
    const many = Array.from({ length: 4000 }, () => [rnd() * 255, rnd() * 255, rnd() * 255, 255]).flat();
    expect(extractSwatches(many, 3).length).toBeLessThanOrEqual(3);
  });

  it("una imagen grande se muestrea y da lo mismo que una pequeña del mismo color", () => {
    const big = new Uint8ClampedArray(200_000 * 4);
    for (let i = 0; i < big.length; i += 4) big.set([30, 120, 90, 255], i);
    expect(paletteFromPixels(big)).toEqual(paletteFromPixels(flat(30, 120, 90)));
  });
});
