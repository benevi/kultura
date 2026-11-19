// ============================================================
// KULTURA — Utilidades de color (OKLCH ↔ sRGB y contraste WCAG)
// ------------------------------------------------------------
// El sistema de diseño se escribe en OKLCH, pero el contraste de
// WCAG 2.x se define sobre sRGB. Estas funciones convierten un token OKLCH a
// sRGB con el mismo recorte por canal que aplica Chrome al pintar, y calculan
// la razón de contraste. Las usan:
// - los tests de contraste y de la tabla de hex del sistema de diseño;
// - la paleta sacada de la imagen de cada obra (`image-palette.ts`), que ajusta
//   la luminosidad en OKLCH hasta cumplir contraste (biblia de diseño, §4);
// - `Avatar`, para elegir el color del texto de las iniciales cuando el color
//   llega como hex suelto (cuentas antiguas).
//
// Fórmulas: OKLab de Björn Ottosson (matrices de la especificación CSS Color 4)
// y luminancia relativa de WCAG 2.1.
// ============================================================

export type Rgb = readonly [number, number, number]

export interface Oklch {
  /** Luminosidad 0-1. */
  l: number
  /** Croma (0-0,4 aprox.). */
  c: number
  /** Matiz en grados. */
  h: number
  /** Opacidad 0-1. */
  alpha: number
}

/** Un color OKLCH sin opacidad. */
export type OklchColor = Pick<Oklch, 'l' | 'c' | 'h'>

/** OKLab: `[L, a, b]`. */
export type Oklab = readonly [number, number, number]

const OKLCH_RE =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i

/** `oklch(68% 0.24 350)` / `oklch(0.68 0.24 350 / 0.3)` → componentes. `null` si no es OKLCH. */
export function parseOklch(value: string): Oklch | null {
  const m = OKLCH_RE.exec(value.trim())
  if (!m) return null
  const l = m[2] ? Number(m[1]) / 100 : Number(m[1])
  const alpha = m[5] === undefined ? 1 : m[6] ? Number(m[5]) / 100 : Number(m[5])
  return { l, c: Number(m[3]), h: Number(m[4]), alpha }
}

/** `#rgb` / `#rrggbb` → sRGB 0-1. `null` si no es un hex válido. */
export function parseHex(value: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const hex = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1]
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Rgb
}

function linearToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** OKLCH → sRGB lineal, sin recortar (puede salirse de 0-1 si el color no cabe en sRGB). */
function oklchToLinear({ l, c, h }: OklchColor): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

/** OKLCH → sRGB 0-1, recortando cada canal al gamut (lo mismo que pinta Chrome). */
export function oklchToSrgb(color: OklchColor): Rgb {
  const [r, g, b] = oklchToLinear(color)
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)]
}

/** sRGB 0-1 → OKLab `[L, a, b]`. */
export function srgbToOklab(rgb: Rgb): Oklab {
  const [r, g, b] = rgb.map(srgbToLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** sRGB 0-1 → OKLCH (matiz en grados, 0-360; 0 si el color no tiene croma). */
export function srgbToOklch(rgb: Rgb): OklchColor {
  const [l, a, b] = srgbToOklab(rgb)
  const c = Math.hypot(a, b)
  const h = c < 1e-7 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { l, c, h }
}

const GAMUT_SLACK = 0.0005
const fitsSrgb = (linear: readonly number[]) =>
  linear.every((v) => v >= -GAMUT_SLACK && v <= 1 + GAMUT_SLACK)

/**
 * OKLCH → sRGB conservando luminosidad y matiz: si el color no cabe en sRGB se
 * baja el croma hasta que cabe (en vez de recortar canales, que cambia el
 * matiz y la luminosidad). El resultado va redondeado a 8 bits por canal, para
 * que el contraste que se calcule con él sea el del `#rrggbb` que se pinta.
 */
export function oklchToSrgbInGamut(color: OklchColor): Rgb {
  const l = Math.min(1, Math.max(0, color.l))
  let linear = oklchToLinear({ l, c: color.c, h: color.h })
  if (!fitsSrgb(linear)) {
    let lo = 0
    let hi = color.c
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      if (fitsSrgb(oklchToLinear({ l, c: mid, h: color.h }))) lo = mid
      else hi = mid
    }
    linear = oklchToLinear({ l, c: lo, h: color.h })
  }
  return linear.map((v) => Math.round(linearToSrgb(v) * 255) / 255) as unknown as Rgb
}

/** Cualquier color que entendemos (OKLCH o hex) → sRGB opaco. `null` si no se reconoce. */
export function toSrgb(value: string): Rgb | null {
  const ok = parseOklch(value)
  if (ok) return oklchToSrgb(ok)
  return parseHex(value)
}

/** sRGB 0-1 → `#rrggbb`. */
export function toHex(rgb: Rgb): string {
  return `#${rgb.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
}

/** Mezcla `fg` sobre `bg` con opacidad `alpha` (composición en sRGB, como el navegador). */
export function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((f, i) => f * alpha + bg[i] * (1 - alpha)) as unknown as Rgb
}

/** Luminancia relativa de WCAG 2.1. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(srgbToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste WCAG (1-21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Paso de luminosidad con el que `ensureContrast` busca. */
const CONTRAST_STEP = 0.005

/**
 * Mueve la luminosidad de `start` (hacia oscuro o hacia claro, sin tocar matiz
 * ni croma más que para caber en sRGB) hasta que el contraste con TODOS los
 * fondos llegue a `ratio`. Devuelve el primer color que cumple, redondeado a
 * 8 bits. Siempre termina: si ni el extremo cumple, devuelve negro o blanco
 * puros, que es lo máximo que esa dirección puede dar (quien llama comprueba
 * el contraste si sus fondos no lo garantizan).
 */
export function ensureContrast(
  start: OklchColor,
  against: readonly Rgb[],
  ratio: number,
  direction: 'darker' | 'lighter',
): Rgb {
  const step = direction === 'darker' ? -CONTRAST_STEP : CONTRAST_STEP
  for (let l = Math.min(1, Math.max(0, start.l)); l >= 0 && l <= 1; l += step) {
    const rgb = oklchToSrgbInGamut({ l, c: start.c, h: start.h })
    if (against.every((bg) => contrastRatio(rgb, bg) >= ratio)) return rgb
  }
  return direction === 'darker' ? [0, 0, 0] : [1, 1, 1]
}

/**
 * Para un fondo dado, qué texto se lee mejor: el claro del sistema
 * (`--text-primary`) o el oscuro (`--surface-base`). `null` si el color no se
 * puede evaluar (p. ej. un `var(--…)`), y entonces decide quien llama.
 */
export function readableTextOn(background: string): 'light' | 'dark' | null {
  const bg = toSrgb(background)
  if (!bg) return null
  const light = oklchToSrgb({ l: 0.97, c: 0.004, h: 280 })
  const dark = oklchToSrgb({ l: 0.16, c: 0.015, h: 280 })
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? 'light' : 'dark'
}
