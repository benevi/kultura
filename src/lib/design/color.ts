// ============================================================
// KULTURA — Utilidades de color (OKLCH → sRGB y contraste WCAG)
// ------------------------------------------------------------
// El sistema de diseño se escribe en OKLCH (DISENO.md), pero el contraste de
// WCAG 2.x se define sobre sRGB. Estas funciones convierten un token OKLCH a
// sRGB con el mismo recorte por canal que aplica Chrome al pintar, y calculan
// la razón de contraste. Las usan:
// - los tests de contraste y de la tabla de hex de DISENO.md;
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

/** OKLCH → sRGB 0-1, recortando cada canal al gamut (lo mismo que pinta Chrome). */
export function oklchToSrgb({ l, c, h }: Pick<Oklch, 'l' | 'c' | 'h'>): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    linearToSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    linearToSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
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
