// Prototipo fase 8.3 — paleta sacada de la portada, con contraste AA garantizado.
// Entra: píxeles RGBA de la portada (canvas pequeño). Sale: 3–5 colores de la
// portada y dos juegos de tokens (claro y oscuro) ya ajustados en OKLCH hasta
// cumplir 7:1 (texto principal), 4.5:1 (texto secundario y acento) y 3:1
// (bordes de componentes). Todo ocurre en el navegador; nada se guarda.

import { contrast, ensureContrast, hex, lchToRgb, rgbToLch, rgbToOklab, type LCH, type RGB } from "./color";

export interface Swatch {
  rgb: RGB;
  lch: LCH;
  /** Parte de la portada que ocupa (0..1). */
  share: number;
}

export interface ThemeTokens {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  edge: string;
  accent: string;
  accentInk: string;
  field: string;
  fieldInk: string;
}

export interface CoverPalette {
  swatches: Swatch[];
  /** La portada no da color útil: tokens neutros. */
  neutral: boolean;
  light: ThemeTokens;
  dark: ThemeTokens;
}

/** Hasta 6 colores de la portada, del más presente al menos. */
export function extractSwatches(data: ArrayLike<number>, max = 6): Swatch[] {
  const buckets = new Map<number, [number, number, number, number]>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cur = buckets.get(key);
    if (cur) {
      cur[0] += r; cur[1] += g; cur[2] += b; cur[3]++;
    } else buckets.set(key, [r, g, b, 1]);
    total++;
  }
  if (!total) return [];
  const sorted = [...buckets.values()].sort((a, b) => b[3] - a[3]);
  const clusters: { sum: [number, number, number]; n: number; lab: [number, number, number] }[] = [];
  for (const [r, g, b, n] of sorted) {
    const lab = rgbToOklab([r / n, g / n, b / n]);
    const hit = clusters.find((c) => Math.hypot(lab[0] - c.lab[0], lab[1] - c.lab[1], lab[2] - c.lab[2]) < 0.065);
    if (hit) {
      hit.sum[0] += r; hit.sum[1] += g; hit.sum[2] += b; hit.n += n;
    } else if (clusters.length < 24) clusters.push({ sum: [r, g, b], n, lab });
  }
  return clusters
    .map((c) => {
      const rgb = c.sum.map((v) => Math.round(v / c.n)) as RGB;
      return { rgb, lch: rgbToLch(rgb), share: c.n / total };
    })
    .filter((s) => s.share >= 0.012)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Texto sobre un relleno de color: blanco roto o casi negro, el que más
 * contraste dé; si ninguno llega a 4.5:1, se mueve el relleno.
 */
function inkOn(fill: LCH, hue: number, dir: "darker" | "lighter"): { fill: RGB; ink: RGB } {
  const white = lchToRgb({ l: 0.985, c: 0.008, h: hue });
  const black = lchToRgb({ l: 0.17, c: 0.025, h: hue });
  let lch = { ...fill };
  for (let i = 0; i < 90; i++) {
    const rgb = lchToRgb(lch);
    const cw = contrast(white, rgb), cb = contrast(black, rgb);
    if (Math.max(cw, cb) >= 4.5) return { fill: rgb, ink: cw >= cb ? white : black };
    lch = { ...lch, l: clamp(lch.l + (dir === "darker" ? -0.01 : 0.01), 0, 1) };
  }
  return { fill: [0, 0, 0], ink: [255, 255, 255] };
}

export function derivePalette(swatches: Swatch[]): CoverPalette {
  const dominant = swatches[0];
  let vivid: Swatch | null = null;
  let best = 0;
  for (const s of swatches) {
    if (s.lch.c < 0.022 || s.lch.l < 0.18 || s.lch.l > 0.94 || s.share < 0.02) continue;
    const score = s.lch.c * Math.pow(s.share, 0.3);
    if (score > best) {
      best = score;
      vivid = s;
    }
  }
  const neutral = !vivid;
  const hv = vivid ? vivid.lch.h : 75;
  // Un color apagado se aviva un poco (sin inventar tono): si no, la franja sale gris.
  const cv = vivid ? clamp(vivid.lch.c * 1.5, 0.055, 0.22) : 0.008;
  const lv = vivid ? vivid.lch.l : 0.5;
  const domColored = !!dominant && dominant.lch.c >= 0.02;
  const hb = domColored ? dominant.lch.h : hv;
  const cdom = domColored ? dominant.lch.c : neutral ? 0.012 : 0.035;

  const build = (mode: "light" | "dark"): ThemeTokens => {
    const L = mode === "light";
    const dir = L ? "darker" : "lighter";
    const cb = L ? clamp(cdom * 0.5, 0.012, 0.05) : clamp(cdom * 0.35, 0.008, 0.035);
    const bg = lchToRgb({ l: L ? 0.905 : 0.165, c: cb, h: hb });
    const surface = lchToRgb({ l: L ? 0.855 : 0.225, c: cb * 1.15, h: hb });
    const both = [bg, surface];
    const ink = ensureContrast({ l: L ? 0.2 : 0.95, c: L ? 0.03 : 0.012, h: hb }, both, 7, dir);
    const ink2 = ensureContrast({ l: L ? 0.43 : 0.76, c: 0.03, h: hb }, both, 4.5, dir);
    const edge = ensureContrast({ l: L ? 0.58 : 0.56, c: 0.03, h: hb }, both, 3, dir);
    // Acento: sirve de texto/enlace sobre el fondo (4.5:1) y de relleno con su texto encima (4.5:1).
    let accent = ensureContrast({ l: L ? 0.5 : 0.8, c: Math.min(cv, L ? 0.19 : 0.16), h: hv }, both, 4.5, dir);
    let accentInk = inkOn(rgbToLch(accent), hv, dir);
    accent = ensureContrast(rgbToLch(accentInk.fill), both, 4.5, dir);
    accentInk = inkOn(rgbToLch(accent), hv, dir);
    // Campo: el color de la portada tal cual, como bloque grande, con su texto.
    const fld = inkOn(
      { l: L ? clamp(lv, 0.52, 0.8) : clamp(lv, 0.3, 0.5), c: Math.min(cv, L ? 0.2 : 0.17), h: hv },
      hv,
      L ? "lighter" : "darker",
    );
    return {
      bg: hex(bg),
      surface: hex(surface),
      ink: hex(ink),
      ink2: hex(ink2),
      edge: hex(edge),
      accent: hex(accentInk.fill),
      accentInk: hex(accentInk.ink),
      field: hex(fld.fill),
      fieldInk: hex(fld.ink),
    };
  };
  return { swatches, neutral, light: build("light"), dark: build("dark") };
}

const KEYS: [keyof ThemeTokens, string][] = [
  ["bg", "bg"],
  ["surface", "surface"],
  ["ink", "ink"],
  ["ink2", "ink-2"],
  ["edge", "edge"],
  ["accent", "accent"],
  ["accentInk", "accent-ink"],
  ["field", "field"],
  ["fieldInk", "field-ink"],
];

/**
 * Variables CSS que se ponen en `.kp`: `--cv-<token>-l` y `--cv-<token>-d`
 * (claro y oscuro) y `--cv-c1…c5` (colores crudos de la portada, solo adorno:
 * sin garantía de contraste).
 */
export function paletteToVars(p: CoverPalette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, name] of KEYS) {
    vars[`--cv-${name}-l`] = p.light[k];
    vars[`--cv-${name}-d`] = p.dark[k];
  }
  p.swatches.forEach((s, i) => {
    vars[`--cv-c${i + 1}`] = hex(s.rgb);
  });
  return vars;
}
