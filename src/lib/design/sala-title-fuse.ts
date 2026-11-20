// ============================================================
// KULTURA — El fundido del rótulo con la imagen, listo para pintar
// ------------------------------------------------------------
// Biblia (`docs/design/BIBLIA.md`), §3. Las reglas están en `title-fuse.ts`
// (22 % de letra tapada como mucho, 3:1, cada letra entera por delante o por
// detrás). Aquí se pasa de unas coberturas ya medidas a lo que `SalaStage`
// pinta, de forma que los topes se cumplen por construcción:
//
// - el plan sale siempre de `planTitleFuse`, nunca de quien llama;
// - si falta un dato, o no se cumple el 3:1, no hay fundido: el título va
//   entero por delante (`null`);
// - una letra que va por delante se pinta entera con su tinta dentro de su
//   caja, con un margen: lo que el margen pise de la letra vecina le quita
//   figura, nunca le añade.
//
// No mide ni lee el DOM. Las coberturas las trae quien llama: la sala, en la
// 8.5, con la máscara de la figura calculada de antemano, o una prueba.
// ============================================================

import { checkTitleFuse, planTitleFuse, type LetterCoverage, type TitleFusePlan, type TitleFuseVerdict } from './title-fuse'

/** Una caja dentro de la sala, en partes de su ancho y de su alto (0–1). */
export interface SalaFuseBox {
  x: number
  y: number
  width: number
  height: number
}

/** Lo medido de una letra: sus píxeles, los que la figura le taparía y dónde está. */
export interface SalaFuseLetter extends LetterCoverage {
  /** Caja de la letra en la sala. Hace falta si la letra acaba yendo por delante. */
  box?: SalaFuseBox
}

/** Lo medido de un título en una composición (la estrecha o la ancha) sobre una imagen. */
export interface SalaFuseData {
  /** Una entrada por letra del título (sin los espacios), en orden de lectura. */
  letters: readonly SalaFuseLetter[]
  /**
   * Contraste mínimo de la tinta del título contra lo que tiene detrás con el
   * fundido puesto (imagen, velo y figura), mirando TODOS los píxeles de
   * letra, también los que la figura taparía. Así no depende del plan y es el
   * peor caso: lo que se ve es una parte de eso.
   */
  minContrast: number
}

export interface SalaFuseResolved {
  plan: TitleFusePlan
  verdict: TitleFuseVerdict
  /** Cajas, ya con su margen, donde la letra se pinta entera por delante de la figura. */
  holes: SalaFuseBox[]
}

/** Margen de la caja de una letra que va por delante, en partes de su alto: los remates que se salen de la caja. */
const HOLE_PAD = 0.06

const isShare = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
const validBox = (box: SalaFuseBox | undefined): box is SalaFuseBox =>
  !!box && isShare(box.x) && isShare(box.y) && isShare(box.width) && isShare(box.height) && box.width > 0 && box.height > 0

/** Cuántas letras tiene un título para el fundido: sus caracteres, sin los espacios. */
export function salaFuseLetterCount(title: string): number {
  return Array.from(title.replace(/\s+/g, '')).length
}

/**
 * De unas coberturas medidas a lo que se pinta. `null` si el título va sin
 * fundido: no hay datos, no casan con el título, no se cumple el 3:1, a una
 * letra que tiene que ir por delante le falta su caja, o no hay nada que
 * fundir. `stageRatio` es el ancho de la sala entre su alto (para el margen).
 */
export function resolveSalaFuse(
  data: SalaFuseData | null | undefined,
  title: string,
  stageRatio = 16 / 9,
): SalaFuseResolved | null {
  if (!data || !Array.isArray(data.letters) || data.letters.length === 0) return null
  if (data.letters.length !== salaFuseLetterCount(title)) return null
  for (const l of data.letters) {
    if (!Number.isInteger(l.line) || l.line < 0 || !isShare(l.letterPixels) || !isShare(l.coveredPixels)) return null
    if (l.coveredPixels > l.letterPixels) return null
  }
  if (typeof data.minContrast !== 'number' || Number.isNaN(data.minContrast)) return null

  const plan = planTitleFuse(data.letters)
  if (!plan.fused) return null
  const verdict = checkTitleFuse({
    coveredShare: plan.coveredShare,
    lineCoveredShares: plan.lineCoveredShares,
    minVisibleContrast: data.minContrast,
    worstLetterShare: plan.worstLetterShare,
  })
  if (!verdict.ok) return null

  const ratio = Number.isFinite(stageRatio) && stageRatio > 0 ? stageRatio : 16 / 9
  const holes: SalaFuseBox[] = []
  for (let i = 0; i < data.letters.length; i++) {
    const letter = data.letters[i]
    if (!plan.inFront[i] || letter.coveredPixels <= 0) continue
    if (!validBox(letter.box)) return null
    // El margen, igual en píxeles a los dos lados: el alto de la caja pasado a partes del ancho.
    const pad = (letter.box.height * HOLE_PAD) / ratio
    const x = Math.max(0, letter.box.x - pad)
    const right = Math.min(1, letter.box.x + letter.box.width + pad)
    const y = Math.max(0, letter.box.y)
    const bottom = Math.min(1, letter.box.y + letter.box.height)
    if (right <= x || bottom <= y) return null
    holes.push({ x, y, width: right - x, height: bottom - y })
  }
  return { plan, verdict, holes }
}

const num = (n: number) => String(Number(n.toFixed(3)))

/** Posición de fondo (en %) que deja una capa de `size` (0–1) empezando en `start` (0–1). */
function backgroundOffset(start: number, size: number): string {
  return size >= 1 ? '0%' : `${num((start / (1 - size)) * 100)}%`
}

/**
 * El fondo (`background`) con el que el título se pinta fundido, recortado a
 * sus letras: la tinta; encima, la figura; y encima, la tinta otra vez en las
 * cajas de las letras que van por delante. `focus` es el punto de interés de
 * la imagen (el mismo `object-position` con el que se pinta).
 */
export function salaFuseBackground(resolved: SalaFuseResolved, figure: string, focus = '50% 50%'): string {
  const ink = 'linear-gradient(var(--sala-ink), var(--sala-ink))'
  const url = `url("${figure.replace(/["\\\n\r]/g,(c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}")`
  return [
    ...resolved.holes.map(
      (h) =>
        `${ink} ${backgroundOffset(h.x, h.width)} ${backgroundOffset(h.y, h.height)} / ${num(h.width * 100)}% ${num(h.height * 100)}% no-repeat`,
    ),
    `${url} ${focus} / cover no-repeat`,
    ink,
  ].join(', ')
}
