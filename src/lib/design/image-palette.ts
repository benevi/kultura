// ============================================================
// KULTURA — Paleta sacada de la imagen de una obra
// ------------------------------------------------------------
// Biblia de diseño (`docs/design/BIBLIA.md`), §4: el color de la ficha sale de
// la imagen de cada obra, en el navegador, y nunca se usa crudo: se ajusta la
// luminosidad en OKLCH hasta cumplir AA (4,5:1 texto, 3:1 componentes) en
// claro y en oscuro.
//
// Este módulo es la parte pura: entran píxeles RGBA (los lee de un `<img>` ya
// cargado quien lo use, con un canvas pequeño) y salen los papeles de la
// biblia en `#rrggbb`. Sin DOM, sin red y sin estado: la misma imagen da
// siempre la misma paleta. Si la imagen no da color útil, o no se pudo leer
// (origen sin CORS, como Google Books), sale la paleta neutra de respaldo.
//
// Todos los contrastes se calculan sobre el color ya redondeado a 8 bits, que
// es el que se pinta. `tests/unit/design/image-palette.test.ts` lo comprueba
// con 3000 portadas al azar.
// ============================================================

import {
  contrastRatio,
  ensureContrast,
  oklchToSrgbInGamut,
  parseHex,
  srgbToOklab,
  srgbToOklch,
  toHex,
  type Oklab,
  type OklchColor,
  type Rgb,
} from './color'

/** Contraste mínimo de texto (WCAG 2.2 AA, 1.4.3). */
export const TEXT_CONTRAST = 4.5
/** Contraste mínimo de componentes y bordes de control (WCAG 2.2 AA, 1.4.11). */
export const COMPONENT_CONTRAST = 3
/**
 * Contraste de la tinta principal. La biblia pide 4,5:1; con los fondos de la
 * biblia llegar a 7:1 (AAA) no cuesta nada, así que se garantiza.
 */
export const PRIMARY_INK_CONTRAST = 7

/** Luminosidad OKLCH de la franja (el color más vivo de la imagen, como bloque). */
export const BAND_LIGHTNESS = {
  light: { min: 0.52, max: 0.8 },
  dark: { min: 0.3, max: 0.5 },
} as const
/** Luminosidad OKLCH del fondo teñido. */
export const BACKGROUND_LIGHTNESS = { light: 0.905, dark: 0.165 } as const
/**
 * Panel: un paso de tono sobre el fondo. Lo que cambia su luminosidad OKLCH
 * respecto a la del fondo (0,855 en claro y 0,225 en oscuro con el fondo teñido).
 */
export const PANEL_LIGHTNESS_STEP = { light: -0.05, dark: 0.06 } as const

/** Los papeles de color de la biblia para un tema, en `#rrggbb`. */
export interface ThemePalette {
  /** Franja: el color más vivo de la imagen, como bloque entero. */
  band: string
  /** Texto sobre la franja (≥ 4,5:1). */
  bandInk: string
  /** Fondo teñido con el tono dominante. */
  background: string
  /** Panel: un paso de tono sobre el fondo, sin líneas ni sombras. */
  panel: string
  /** Tinta principal sobre fondo y panel (≥ 7:1). */
  ink: string
  /** Tinta secundaria sobre fondo y panel (≥ 4,5:1). */
  inkSecondary: string
  /** Acento: enlaces sobre fondo y panel (≥ 4,5:1) y relleno de la acción principal. */
  accent: string
  /** Texto sobre un relleno de acento (≥ 4,5:1). */
  accentInk: string
  /** Borde de componente sobre fondo y panel (≥ 3:1). */
  border: string
}

export interface ImagePalette {
  /** `true` si es la paleta neutra de respaldo. */
  neutral: boolean
  light: ThemePalette
  dark: ThemePalette
}

/** Un color de la imagen. */
export interface Swatch {
  /** sRGB 0-1. */
  rgb: Rgb
  oklch: OklchColor
  /** Parte de los píxeles opacos de la imagen que ocupa (0-1). */
  share: number
}

type Mode = 'light' | 'dark'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ------------------------------------------------------------
// 1. De píxeles a colores
// ------------------------------------------------------------

/** Por debajo de este alfa (0-255) un píxel no cuenta. */
const MIN_ALPHA = 128
/** Píxeles que se leen como mucho; una imagen mayor se muestrea a saltos. */
const MAX_SAMPLES = 16_384
/** Distancia en OKLab por debajo de la cual dos colores son el mismo. */
const MERGE_DISTANCE = 0.065
const MAX_CLUSTERS = 24
/** Un color que ocupa menos que esto es ruido. */
const MIN_SHARE = 0.012

/**
 * Colores de una imagen, del más presente al menos (como mucho `max`).
 * `pixels` es RGBA de 8 bits por canal, como `ImageData.data`. Los píxeles
 * transparentes y los valores que no son números se saltan; una imagen vacía
 * o toda transparente da `[]`.
 */
export function extractSwatches(pixels: ArrayLike<number>, max = 6): Swatch[] {
  const count = Math.floor(pixels.length / 4)
  const stride = Math.max(1, Math.ceil(count / MAX_SAMPLES))
  // Histograma de 5 bits por canal: [suma r, suma g, suma b, píxeles].
  const buckets = new Map<number, [number, number, number, number]>()
  let total = 0
  for (let p = 0; p < count; p += stride) {
    const i = p * 4
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (!(a >= MIN_ALPHA) || !Number.isFinite(r + g + b)) continue
    const r8 = clamp(Math.round(r), 0, 255)
    const g8 = clamp(Math.round(g), 0, 255)
    const b8 = clamp(Math.round(b), 0, 255)
    const key = ((r8 >> 3) << 10) | ((g8 >> 3) << 5) | (b8 >> 3)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket[0] += r8
      bucket[1] += g8
      bucket[2] += b8
      bucket[3]++
    } else buckets.set(key, [r8, g8, b8, 1])
    total++
  }
  if (!total) return []

  // Se juntan los colores vecinos, empezando por los más presentes.
  const clusters: { sum: [number, number, number]; n: number; lab: Oklab }[] = []
  for (const [r, g, b, n] of [...buckets.values()].sort((x, y) => y[3] - x[3])) {
    const lab = srgbToOklab([r / n / 255, g / n / 255, b / n / 255])
    const near = clusters.find(
      (c) => Math.hypot(lab[0] - c.lab[0], lab[1] - c.lab[1], lab[2] - c.lab[2]) < MERGE_DISTANCE,
    )
    if (near) {
      near.sum[0] += r
      near.sum[1] += g
      near.sum[2] += b
      near.n += n
    } else if (clusters.length < MAX_CLUSTERS) clusters.push({ sum: [r, g, b], n, lab })
  }
  return clusters
    .map((c): Swatch => {
      const rgb: Rgb = [c.sum[0] / c.n / 255, c.sum[1] / c.n / 255, c.sum[2] / c.n / 255]
      return { rgb, oklch: srgbToOklch(rgb), share: c.n / total }
    })
    .filter((s) => s.share >= MIN_SHARE)
    .sort((x, y) => y.share - x.share)
    .slice(0, max)
}

// ------------------------------------------------------------
// 2. De colores a papeles
// ------------------------------------------------------------

/** Lo que se toma de la imagen: un tono para teñir y un color vivo. */
interface Seed {
  /** Tono y croma del fondo (ya en el croma de fondo de cada tema). */
  tintHue: number
  tintChroma: Record<Mode, number>
  /** El color más vivo: matiz, croma y luminosidad de partida de la franja. */
  vividHue: number
  vividChroma: number
  vividLightness: number
  /** Fondo y tinta fijos (paleta neutra): no se calculan. */
  fixed?: Record<Mode, { background: Rgb; ink: Rgb }>
}

/** Margen dentro del rango de la franja, para que el redondeo a 8 bits no la saque. */
const BAND_INSET = 0.004
const LIGHTNESS_STEP = 0.005

/** Las dos tintas posibles sobre un relleno: blanco roto y casi negro, con el matiz del relleno. */
function inksFor(hue: number): [Rgb, Rgb] {
  return [
    oklchToSrgbInGamut({ l: 0.985, c: 0.008, h: hue }),
    oklchToSrgbInGamut({ l: 0.17, c: 0.025, h: hue }),
  ]
}

/** La tinta (de las dadas) que más contraste da sobre `fill`, y cuánto. */
function bestInk(fill: Rgb, inks: readonly Rgb[]): { ink: Rgb; ratio: number } {
  let best = { ink: inks[0], ratio: contrastRatio(inks[0], fill) }
  for (const ink of inks.slice(1)) {
    const ratio = contrastRatio(ink, fill)
    if (ratio > best.ratio) best = { ink, ratio }
  }
  return best
}

const PURE_INKS: readonly Rgb[] = [
  [1, 1, 1],
  [0, 0, 0],
]

/**
 * Relleno con su tinta. Parte de `start` y mueve la luminosidad en `direction`
 * sin salir de `[min, max]`, hasta que el relleno pase `accepts` y una de las
 * dos tintas del matiz dé 4,5:1. Si ningún paso lo logra, se queda con el
 * primer relleno que pasó `accepts` (el de partida, si pasa) y tinta blanca o negra
 * pura: una de las dos da siempre al menos 4,58:1 sobre cualquier color.
 */
export function fillWithInk(
  start: OklchColor,
  range: { min: number; max: number },
  direction: 'darker' | 'lighter',
  accepts: (fill: Rgb) => boolean = () => true,
): { fill: Rgb; ink: Rgb } {
  const inks = inksFor(start.h)
  const step = direction === 'darker' ? -LIGHTNESS_STEP : LIGHTNESS_STEP
  let fallback: Rgb | null = null
  for (let l = clamp(start.l, range.min, range.max); l >= range.min && l <= range.max; l += step) {
    const fill = oklchToSrgbInGamut({ l, c: start.c, h: start.h })
    if (!accepts(fill)) continue
    fallback ??= fill
    const { ink, ratio } = bestInk(fill, inks)
    if (ratio >= TEXT_CONTRAST) return { fill, ink }
  }
  // Sin relleno aceptable en el rango, el extremo: negro o blanco.
  const fill = fallback ?? (direction === 'darker' ? ([0, 0, 0] as Rgb) : ([1, 1, 1] as Rgb))
  return { fill, ink: bestInk(fill, PURE_INKS).ink }
}

function buildTheme(mode: Mode, seed: Seed): ThemePalette {
  const light = mode === 'light'
  // Sobre fondo claro el texto se oscurece hasta cumplir; sobre oscuro, se aclara.
  const toward = light ? 'darker' : 'lighter'
  const tint = { c: seed.tintChroma[mode], h: seed.tintHue }

  const background =
    seed.fixed?.[mode].background ?? oklchToSrgbInGamut({ l: BACKGROUND_LIGHTNESS[mode], ...tint })
  const panel = oklchToSrgbInGamut({
    l: (seed.fixed ? srgbToOklch(background).l : BACKGROUND_LIGHTNESS[mode]) + PANEL_LIGHTNESS_STEP[mode],
    c: tint.c * 1.15,
    h: tint.h,
  })
  const surfaces = [background, panel]

  const ink =
    seed.fixed?.[mode].ink ??
    ensureContrast({ l: light ? 0.2 : 0.95, c: light ? 0.03 : 0.012, h: tint.h }, surfaces, PRIMARY_INK_CONTRAST, toward)
  // En la neutra, tinta secundaria y borde llevan el croma del fondo: son grises, no pardos.
  const quiet = seed.fixed ? tint.c : 0.03
  const inkSecondary = ensureContrast({ l: light ? 0.43 : 0.76, c: quiet, h: tint.h }, surfaces, TEXT_CONTRAST, toward)
  const border = ensureContrast({ l: light ? 0.58 : 0.56, c: quiet, h: tint.h }, surfaces, COMPONENT_CONTRAST, toward)

  // Acento: vale de texto sobre fondo y panel, y de relleno con su texto encima.
  const accent = fillWithInk(
    { l: light ? 0.5 : 0.8, c: Math.min(seed.vividChroma, light ? 0.19 : 0.16), h: seed.vividHue },
    { min: 0, max: 1 },
    toward,
    (fill) => surfaces.every((s) => contrastRatio(fill, s) >= TEXT_CONTRAST),
  )

  // Franja: el color de la imagen como bloque, dentro del rango de luminosidad
  // de su tema. Si hay que moverla, en claro se aclara y en oscuro se oscurece.
  const range = BAND_LIGHTNESS[mode]
  const band = fillWithInk(
    { l: seed.vividLightness, c: Math.min(seed.vividChroma, light ? 0.2 : 0.17), h: seed.vividHue },
    { min: range.min + BAND_INSET, max: range.max - BAND_INSET },
    light ? 'lighter' : 'darker',
  )

  return {
    band: toHex(band.fill),
    bandInk: toHex(band.ink),
    background: toHex(background),
    panel: toHex(panel),
    ink: toHex(ink),
    inkSecondary: toHex(inkSecondary),
    accent: toHex(accent.fill),
    accentInk: toHex(accent.ink),
    border: toHex(border),
  }
}

const hexRgb = (hex: string): Rgb => parseHex(hex) as Rgb

/** Neutros de respaldo de la biblia (§4): fondo y tinta, en claro y en oscuro. */
export const NEUTRAL_BASE = {
  light: { background: '#e6e3dd', ink: '#1b1a17' },
  dark: { background: '#171614', ink: '#f2f0eb' },
} as const

function buildNeutral(): ImagePalette {
  // El tono (cálido, casi sin croma) es el del fondo neutro de cada tema.
  const lightBg = srgbToOklch(hexRgb(NEUTRAL_BASE.light.background))
  const darkBg = srgbToOklch(hexRgb(NEUTRAL_BASE.dark.background))
  const seed: Seed = {
    tintHue: lightBg.h,
    tintChroma: { light: lightBg.c, dark: darkBg.c },
    vividHue: lightBg.h,
    vividChroma: 0.008,
    vividLightness: 0.5,
    fixed: {
      light: { background: hexRgb(NEUTRAL_BASE.light.background), ink: hexRgb(NEUTRAL_BASE.light.ink) },
      dark: { background: hexRgb(NEUTRAL_BASE.dark.background), ink: hexRgb(NEUTRAL_BASE.dark.ink) },
    },
  }
  return { neutral: true, light: buildTheme('light', seed), dark: buildTheme('dark', seed) }
}

/**
 * Paleta neutra de respaldo: la que vale mientras la imagen llega, cuando no da
 * color útil y cuando su origen no deja leerla.
 */
export const NEUTRAL_PALETTE: ImagePalette = buildNeutral()

/**
 * Un color cuenta como «vivo» si tiene croma, no es casi negro ni casi blanco y
 * ocupa algo. Un color muy claro solo vale si tiene croma de sobra (un amarillo
 * puro tiene L 0,97): un papel crema no es un color.
 */
const VIVID = {
  minChroma: 0.022,
  minLightness: 0.18,
  maxLightness: 0.94,
  brightMinChroma: 0.08,
  minShare: 0.02,
} as const
/** Croma mínimo del color dominante para teñir el fondo con su tono. */
const TINT_MIN_CHROMA = 0.02

/**
 * Papeles de la biblia a partir de los colores de una imagen (`extractSwatches`).
 * Si ninguno es un color útil, devuelve `NEUTRAL_PALETTE`.
 */
export function paletteFromSwatches(input: readonly Swatch[]): ImagePalette {
  // Una muestra con algún valor que no es un número no es un color: se salta.
  const swatches = input.filter((s) => Number.isFinite(s.oklch.l + s.oklch.c + s.oklch.h + s.share))
  let vivid: Swatch | null = null
  let best = 0
  for (const s of swatches) {
    const { l, c } = s.oklch
    if (c < VIVID.minChroma || l < VIVID.minLightness || s.share < VIVID.minShare) continue
    if (l > VIVID.maxLightness && c < VIVID.brightMinChroma) continue
    // El más vivo, pesando un poco cuánto ocupa: un punto de color no manda sobre una mancha.
    const score = c * s.share ** 0.3
    if (score > best) {
      best = score
      vivid = s
    }
  }
  if (!vivid) return NEUTRAL_PALETTE

  // El fondo se tiñe con el tono dominante; si el dominante es gris, con el vivo.
  const dominant = swatches[0]
  const tinted = dominant.oklch.c >= TINT_MIN_CHROMA
  const tintChroma = tinted ? dominant.oklch.c : 0.035
  const seed: Seed = {
    tintHue: tinted ? dominant.oklch.h : vivid.oklch.h,
    tintChroma: {
      light: clamp(tintChroma * 0.5, 0.012, 0.05),
      dark: clamp(tintChroma * 0.35, 0.008, 0.035),
    },
    vividHue: vivid.oklch.h,
    // Un color apagado se aviva un poco, sin cambiarle el tono: si no, la franja sale gris.
    vividChroma: clamp(vivid.oklch.c * 1.5, 0.055, 0.22),
    vividLightness: vivid.oklch.l,
  }
  return { neutral: false, light: buildTheme('light', seed), dark: buildTheme('dark', seed) }
}

/**
 * Paleta de una imagen a partir de sus píxeles RGBA (`ImageData.data` de un
 * canvas pequeño; con 40 px de lado mayor basta). `null` o `undefined` —la
 * imagen no se pudo leer— da la paleta neutra, igual que una imagen vacía,
 * transparente o sin color útil.
 */
export function paletteFromPixels(pixels: ArrayLike<number> | null | undefined): ImagePalette {
  if (!pixels) return NEUTRAL_PALETTE
  return paletteFromSwatches(extractSwatches(pixels))
}
