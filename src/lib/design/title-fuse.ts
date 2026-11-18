// ============================================================
// KULTURA — Tope del fundido del título con la imagen
// ------------------------------------------------------------
// Biblia de diseño (`docs/design/BIBLIA.md`), §3 y §9. El título vive dentro de
// la imagen y partes de ella pasan por delante de las letras. Como eso se
// decide obra a obra, las reglas se miden, no se miran:
//
// - la imagen tapa como mucho el 22 % de la letra, medido sobre los píxeles de
//   letra, en el título entero y en cada línea;
// - toda la letra visible guarda al menos 3:1 contra lo que tiene detrás;
// - cada letra va entera por detrás o entera por delante de la figura, y una
//   letra que quedaría tapada más del 35 % pasa entera por delante;
// - si una imagen no lo permite, esa obra va sin fundido.
//
// Aquí están las reglas como funciones puras. No pintan ni leen el DOM: quien
// las llama (la sala, en la 8.5, o una prueba con capturas) trae los datos, ya
// sea como rejillas de píxeles o como porcentajes medidos.
// ============================================================

import { contrastRatio, type Rgb } from './color'

/** Parte máxima de los píxeles de letra que la imagen puede tapar (título entero y cada línea). */
export const TITLE_FUSE_MAX_COVERED = 0.22
/** Contraste mínimo de la letra visible contra lo que tiene detrás. */
export const TITLE_FUSE_MIN_CONTRAST = 3
/** Una letra que quedaría tapada MÁS que esto pasa entera por delante de la figura. */
export const TITLE_LETTER_MAX_COVERED = 0.35

/** Valor (0-255) a partir del cual un píxel de una máscara cuenta. */
const MASK_ON = 128

/** Lo que se mide de una letra: cuántos píxeles tiene y cuántos le taparía la figura si fuera por detrás. */
export interface LetterCoverage {
  /** Línea del título a la que pertenece (0, 1, 2…). */
  line: number
  /** Píxeles de letra. */
  letterPixels: number
  /** De esos, los que la figura taparía. */
  coveredPixels: number
}

export interface TitleFusePlan {
  /** Por letra: `true` si va entera por delante de la figura; `false`, entera por detrás. */
  inFront: boolean[]
  /** Parte de los píxeles de letra del título que queda tapada (0-1). */
  coveredShare: number
  /** Lo mismo por línea (índice = línea; una línea sin letra da 0). */
  lineCoveredShares: number[]
  /** La letra más tapada de las que van por detrás (0-1). */
  worstLetterShare: number
  /** `true` si alguna parte de la figura pasa por delante de alguna letra. */
  fused: boolean
}

/** ¿Pasa esta letra entera por delante? Solo si quedaría tapada más del 35 %; el 35 % justo va por detrás. */
export function letterGoesInFront(coveredShare: number): boolean {
  return coveredShare > TITLE_LETTER_MAX_COVERED
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/**
 * Decide qué letras van por detrás de la figura y cuáles por delante.
 *
 * 1. Una letra que quedaría tapada más del 35 % va por delante.
 * 2. Si aun así el título, o una línea, pasan del tope, se va sacando por
 *    delante la letra más tapada (de esa línea, o de todo el título) hasta
 *    que cumplen. En el peor caso todas van por delante: sin fundido.
 *
 * `maxCovered` es el tope de tapado; por defecto, el 22 % de la biblia. Quien
 * mueva la figura sobre la letra (parallax) puede pedir menos para dejarse
 * margen, nunca más.
 */
export function planTitleFuse(
  letters: readonly LetterCoverage[],
  maxCovered: number = TITLE_FUSE_MAX_COVERED,
): TitleFusePlan {
  const limit = Math.min(maxCovered, TITLE_FUSE_MAX_COVERED)
  const lineCount = letters.reduce((n, l) => Math.max(n, l.line + 1), 0)
  const lineTotal = new Array<number>(lineCount).fill(0)
  let total = 0
  for (const l of letters) {
    lineTotal[l.line] += l.letterPixels
    total += l.letterPixels
  }
  const inFront = letters.map(
    (l) => l.letterPixels <= 0 || letterGoesInFront(share(l.coveredPixels, l.letterPixels)),
  )

  const measure = () => {
    const lineCovered = new Array<number>(lineCount).fill(0)
    let covered = 0
    letters.forEach((l, i) => {
      if (inFront[i]) return
      lineCovered[l.line] += l.coveredPixels
      covered += l.coveredPixels
    })
    return {
      coveredShare: share(covered, total),
      lineCoveredShares: lineCovered.map((c, line) => share(c, lineTotal[line])),
    }
  }

  let measured = measure()
  for (let guard = 0; guard < letters.length; guard++) {
    const titleOver = measured.coveredShare > limit
    // Si el título entero cumple, la primera línea que se pasa (-1: ninguna).
    const lineOver = titleOver ? -1 : measured.lineCoveredShares.findIndex((s) => s > limit)
    if (!titleOver && lineOver < 0) break
    let worst = -1
    letters.forEach((l, i) => {
      if (inFront[i] || l.coveredPixels <= 0 || (lineOver >= 0 && l.line !== lineOver)) return
      if (worst < 0 || l.coveredPixels > letters[worst].coveredPixels) worst = i
    })
    if (worst < 0) break
    inFront[worst] = true
    measured = measure()
  }

  let worstLetterShare = 0
  letters.forEach((l, i) => {
    if (!inFront[i]) worstLetterShare = Math.max(worstLetterShare, share(l.coveredPixels, l.letterPixels))
  })
  return { inFront, ...measured, worstLetterShare, fused: measured.coveredShare > 0 }
}

/** Lo medido de un título ya compuesto (por `planTitleFuse` y `measureVisibleContrast`, o sobre una captura). */
export interface TitleFuseMeasure {
  /** Parte de los píxeles de letra del título tapada por la imagen (0-1). */
  coveredShare: number
  /** Lo mismo por línea. */
  lineCoveredShares: readonly number[]
  /** Contraste mínimo de la letra visible contra lo que tiene detrás. */
  minVisibleContrast: number
  /** La letra más tapada de las que van por detrás (0-1), en reposo. Si no se da, no se juzga. */
  worstLetterShare?: number
}

export interface TitleFuseVerdict {
  /** `true` si el título puede ir fundido tal como se midió. Si no, esa obra va sin fundido. */
  ok: boolean
  /** Título entero ≤ 22 %. */
  titleOk: boolean
  /** Cada línea ≤ 22 %. */
  linesOk: boolean
  /** Toda la letra visible ≥ 3:1. */
  contrastOk: boolean
  /** Ninguna letra por detrás tapada más del 35 %. */
  lettersOk: boolean
}

/** Las reglas de la biblia sobre porcentajes ya medidos. Los límites justos (22 %, 3:1, 35 %) cumplen. */
export function checkTitleFuse(measure: TitleFuseMeasure): TitleFuseVerdict {
  const titleOk = measure.coveredShare <= TITLE_FUSE_MAX_COVERED
  const linesOk = measure.lineCoveredShares.every((s) => s <= TITLE_FUSE_MAX_COVERED)
  const contrastOk = measure.minVisibleContrast >= TITLE_FUSE_MIN_CONTRAST
  const lettersOk = measure.worstLetterShare === undefined || !letterGoesInFront(measure.worstLetterShare)
  return { ok: titleOk && linesOk && contrastOk && lettersOk, titleOk, linesOk, contrastOk, lettersOk }
}

// ------------------------------------------------------------
// Medir sobre píxeles
// ------------------------------------------------------------

/** Caja de una letra dentro de la rejilla del título, en píxeles de esa rejilla. */
export interface LetterBox {
  x: number
  y: number
  width: number
  height: number
  /** Línea del título (0, 1, 2…). */
  line: number
}

/**
 * El título y la figura sobre una misma rejilla de `width` × `height` píxeles
 * (quien llama lleva la máscara de la figura a la rejilla del título, con el
 * encuadre y el zoom con que se pinta). Un valor por píxel, 0-255, por filas.
 */
export interface TitleRaster {
  width: number
  height: number
  /** Alfa del título: ≥ 128 es letra. */
  letter: ArrayLike<number>
  /** Máscara de primer plano de la imagen: ≥ 128 es figura. */
  figure: ArrayLike<number>
  /** Una caja por letra. No deben solaparse: un píxel de letra cuenta en cada caja que lo contiene. */
  letters: readonly LetterBox[]
}

/** Recorre los píxeles de letra de cada caja. */
function eachLetterPixel(raster: TitleRaster, visit: (letterIndex: number, pixel: number) => void): void {
  const { width, height, letter } = raster
  raster.letters.forEach((box, index) => {
    const x0 = Math.max(0, Math.floor(box.x))
    const y0 = Math.max(0, Math.floor(box.y))
    const x1 = Math.min(width, Math.ceil(box.x + box.width))
    const y1 = Math.min(height, Math.ceil(box.y + box.height))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const pixel = y * width + x
        if (letter[pixel] >= MASK_ON) visit(index, pixel)
      }
    }
  })
}

/** Cuenta, letra a letra, los píxeles de letra y los que la figura taparía. Entra en `planTitleFuse`. */
export function measureLetterCoverage(raster: TitleRaster): LetterCoverage[] {
  const out = raster.letters.map((box): LetterCoverage => ({ line: box.line, letterPixels: 0, coveredPixels: 0 }))
  eachLetterPixel(raster, (index, pixel) => {
    out[index].letterPixels++
    if (raster.figure[pixel] >= MASK_ON) out[index].coveredPixels++
  })
  return out
}

export interface VisibleContrast {
  /** Píxeles de letra que se ven (no tapados por la figura). */
  visiblePixels: number
  /** Contraste del peor píxel visible; `Infinity` si no se ve ninguno. */
  minContrast: number
  /** Píxeles visibles por debajo de 3:1. */
  failingPixels: number
}

/**
 * Contraste de la letra visible contra lo que tiene detrás.
 *
 * - `inFront`: el plan de `planTitleFuse` (una letra por delante se ve entera;
 *   de una por detrás solo se ve lo que la figura no tapa).
 * - `behind`: lo que queda detrás del título ya compuesto (imagen con su velo),
 *   en RGBA de 8 bits sobre la misma rejilla, como `ImageData.data`. El alfa no
 *   se usa: es lo que se ve, ya opaco.
 * - `ink`: el color de la letra, sRGB 0-1.
 */
export function measureVisibleContrast(
  raster: TitleRaster,
  inFront: readonly boolean[],
  behind: ArrayLike<number>,
  ink: Rgb,
): VisibleContrast {
  const result: VisibleContrast = { visiblePixels: 0, minContrast: Infinity, failingPixels: 0 }
  eachLetterPixel(raster, (index, pixel) => {
    if (!inFront[index] && raster.figure[pixel] >= MASK_ON) return
    const i = pixel * 4
    const ratio = contrastRatio(ink, [behind[i] / 255, behind[i + 1] / 255, behind[i + 2] / 255])
    result.visiblePixels++
    if (ratio < result.minContrast) result.minContrast = ratio
    if (ratio < TITLE_FUSE_MIN_CONTRAST) result.failingPixels++
  })
  return result
}
