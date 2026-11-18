// Prototipo fase 8.3 — color: sRGB <-> OKLCH y contraste WCAG. Funciones puras.

export type RGB = [number, number, number]; // 0..255
export interface LCH {
  l: number; // 0..1
  c: number; // ~0..0.4
  h: number; // grados
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]: RGB | number[]): [number, number, number] {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function rgbToLch(rgb: RGB | number[]): LCH {
  const [l, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c, h };
}

function lchToLinear({ l, c, h }: LCH): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (lin: number[]) => lin.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH -> sRGB. Si se sale de gama, baja el croma (conserva L y tono). */
export function lchToRgb(lch: LCH): RGB {
  const l = Math.min(1, Math.max(0, lch.l));
  let lin = lchToLinear({ ...lch, l });
  if (!inGamut(lin)) {
    let lo = 0, hi = lch.c;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToLinear({ l, c: mid, h: lch.h }))) lo = mid;
      else hi = mid;
    }
    lin = lchToLinear({ l, c: lo, h: lch.h });
  }
  return lin.map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)) as RGB;
}

export function luminance([r, g, b]: RGB | number[]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const hex = ([r, g, b]: RGB) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * Mueve la luminosidad de `start` (a más oscuro o a más claro) hasta que el
 * contraste con TODOS los fondos llegue a `ratio`. Siempre termina: en el
 * extremo devuelve negro o blanco.
 */
export function ensureContrast(start: LCH, against: RGB[], ratio: number, dir: "darker" | "lighter"): RGB {
  const step = dir === "darker" ? -0.01 : 0.01;
  let lch = { ...start };
  for (let i = 0; i < 110; i++) {
    const rgb = lchToRgb(lch);
    if (against.every((bg) => contrast(rgb, bg) >= ratio)) return rgb;
    const l = lch.l + step;
    if (l < 0 || l > 1) break;
    lch = { ...lch, l };
  }
  return dir === "darker" ? [0, 0, 0] : [255, 255, 255];
}
