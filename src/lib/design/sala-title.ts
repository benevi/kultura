// ============================================================
// KULTURA — El rótulo de «Sala»: anchura y tamaño de un título
// ------------------------------------------------------------
// Biblia (`docs/design/BIBLIA.md`), §5: el rótulo va en Anybody y «la anchura
// se elige por la longitud del título, que llena el ancho en 1–2 líneas (3 en
// móvil)».
//
// Aquí se decide, solo con el texto, cómo se compone un título: por dónde se
// parte, con qué anchura del eje `wdth` (50–150 %) y a qué tamaño, como parte
// del ancho de su caja. Es una función pura: no pinta ni mide en el
// navegador. Sabe lo que mide cada carácter porque los avances de Anybody
// están medidos de antemano (`sala-title-metrics.ts`, generado).
//
// Por qué así: el resultado sale en el HTML del servidor, vale para cualquier
// ancho (el tamaño va en unidades del contenedor) y no cambia al hidratar ni
// al llegar la fuente: el número de líneas está decidido antes de pintar.
//
// Garantía (la comprueba `tests/unit/design/sala-title.test.ts` para
// cualquier título de 1 a 120 caracteres): la anchura queda entre 55 y 150,
// ninguna línea mide más que la caja y el tamaño no baja del mínimo legible.
// La suma de avances es un tope: el interletraje de Anybody solo estrecha.
// ============================================================

import { SALA_TITLE_ADVANCES_RAW } from './sala-title-metrics'
import { SALA_TYPE } from './sala-tokens'

/** Límites de anchura del rótulo (%). Anybody llega a 50, pero por debajo de 55 las letras de los títulos largos se pegan en móvil (decisión de Víctor, 2026-11-20). */
export const SALA_TITLE_STRETCH_MIN = 55
export const SALA_TITLE_STRETCH_MAX = 150

/** Ancho de caja mínimo para el que vale la garantía (320 px de ventana menos los márgenes). */
export const SALA_TITLE_MIN_BOX = 280
/** A partir de este ancho de contenedor vale la composición ancha (en `rem`: crece con el texto del usuario). */
export const SALA_TITLE_WIDE_FROM_REM = 45
/** Tamaño mínimo del rótulo en píxeles, con el texto del navegador a 16 px. */
export const SALA_TITLE_MIN_PX = 18
/** Títulos más largos que esto se componen igual, pero la garantía de tamaño mínimo ya no vale. */
export const SALA_TITLE_MAX_LENGTH = 120

/**
 * Holgura de cada línea respecto de la caja. Los avances medidos son los de
 * Chromium con posicionamiento subpíxel (Windows, macOS, Android); Chromium en
 * Linux sin él redondea cada avance a píxeles enteros y pinta hasta un 0,4 %
 * más ancho (medido en el CI). Un 3 % cubre ese redondeo con creces también en
 * una línea de muchas letras a 18 px.
 */
export const SALA_TITLE_SAFETY = 0.03
const SAFETY = SALA_TITLE_SAFETY
/** Más líneas solo si el cuerpo crece al menos esto. */
const LINE_GAIN = 1.15
/** Cuánto se puede ensanchar un título, sobre la anchura que le toca, para llenar la caja. */
const WIDEN = 35
/** Líneas de más que se admiten cuando el título no cabe al tamaño mínimo. */
const OVERFLOW_LINES = 20

const LETTER_SPACING = parseFloat(SALA_TYPE.title.letterSpacing ?? '0')
const LINE_HEIGHT = parseFloat(SALA_TYPE.title.lineHeight)
/**
 * Interlineado de un título con japonés, coreano o chino. Sus caracteres
 * llenan el em de arriba abajo: con el 0,9 de Anybody una línea toca la
 * siguiente («살인의 / 추억»).
 */
export const SALA_TITLE_CJK_LINE_HEIGHT = 1.1

/** Reglas de una composición. Los tamaños son partes por cien del ancho de la caja. */
export interface SalaTitleRules {
  /** Líneas como mucho (si el título cabe al tamaño mínimo). */
  maxLines: number
  /** Cuerpo máximo. */
  maxSize: number
  /** Alto máximo del bloque (líneas × interlineado × cuerpo). */
  maxBlock: number
  /** Cuerpo mínimo: por debajo se añaden líneas. */
  minSize: number
  /** Factor sobre la anchura que toca por longitud: en una caja estrecha, más estrecha (letra más alta). */
  stretchScale: number
}

export interface SalaTitlePreset {
  narrow: SalaTitleRules
  wide: SalaTitleRules
}

/**
 * Composiciones. `sala` es el rótulo de la ficha: hasta 3 líneas en estrecho y
 * 2 en ancho (biblia §5). `poster` es el rótulo del sustituto de un póster:
 * una caja pequeña, hasta 4 líneas; su tamaño mínimo lo pone el CSS en `rem`,
 * porque aquí no se sabe cuántos píxeles mide la caja.
 * Los números (cuerpos máximos, la curva de anchura) salen del prototipo
 * firmado: son propuesta.
 */
export const SALA_TITLE_PRESET = {
  sala: {
    narrow: { maxLines: 3, maxSize: 30, maxBlock: 60, minSize: (SALA_TITLE_MIN_PX / SALA_TITLE_MIN_BOX) * 100, stretchScale: 0.72 },
    wide: { maxLines: 2, maxSize: 22, maxBlock: 40, minSize: (SALA_TITLE_MIN_PX / (SALA_TITLE_WIDE_FROM_REM * 16)) * 100, stretchScale: 1 },
  },
  poster: {
    narrow: { maxLines: 4, maxSize: 26, maxBlock: 90, minSize: 9, stretchScale: 0.72 },
    wide: { maxLines: 4, maxSize: 26, maxBlock: 90, minSize: 9, stretchScale: 0.72 },
  },
} satisfies Record<string, SalaTitlePreset>

/** Una composición ya resuelta. */
export interface SalaTitleLayout {
  /** Índice del primer trozo de cada línea (el primero es siempre 0). */
  starts: number[]
  /** Eje de anchura, entero, 55–150 (%). */
  stretch: number
  /** Cuerpo, en partes por cien del ancho de la caja (es decir, en `cqw`). */
  size: number
  /** Ancho de cada línea, en em, a esa anchura. */
  widths: number[]
  /** Parte del ancho de la caja que ocupa la línea más larga (0–1). */
  fill: number
  /** Alto del bloque, en partes por cien del ancho de la caja. */
  block: number
}

export interface SalaTitlePlan {
  /** El título, sin espacios de sobra, partido en trozos que no se separan. */
  chunks: string[]
  /** Lo que va delante de cada trozo dentro de una línea: un espacio o nada (el primero, nada). */
  joins: Array<'' | ' '>
  narrow: SalaTitleLayout
  wide: SalaTitleLayout
  /**
   * `true` si todos los caracteres están medidos (Anybody) o miden un em
   * (japonés, coreano, chino). Con otros (cirílico, emoji…) el ancho es una
   * estimación: el título se compone igual y, si no cupiera, el navegador
   * parte la línea; no se sale de la caja.
   */
  exact: boolean
  /** Interlineado (en em): el de `sala-type-title` o, con japonés o coreano, `SALA_TITLE_CJK_LINE_HEIGHT`. */
  lineHeight: number
}

// ------------------------------------------------------------
// Lo que mide un carácter
// ------------------------------------------------------------

let advances: Map<number, readonly [number, number, number]> | null = null

function table(): Map<number, readonly [number, number, number]> {
  if (advances) return advances
  advances = new Map()
  for (const entry of SALA_TITLE_ADVANCES_RAW.split(' ')) {
    const [cp, lo, mid, hi] = entry.split(':').map((n) => parseInt(n, 36))
    advances.set(cp, [lo / 1000, mid / 1000, hi / 1000])
  }
  return advances
}

/** ¿Japonés, coreano o chino (un em por carácter, sin eje de anchura)? */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x11ff) || // jamo
    (cp >= 0x2e80 && cp <= 0x303f) || // radicales y puntuación CJK
    (cp >= 0x3040 && cp <= 0x30ff) || // hiragana y katakana
    (cp >= 0x3100 && cp <= 0x318f) ||
    (cp >= 0x31f0 && cp <= 0x9fff) || // katakana extendido e ideogramas
    (cp >= 0xac00 && cp <= 0xd7af) || // hangul
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) || // formas de ancho completo
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3134f)
  )
}

/** No ocupa: marcas que se combinan, uniones y selectores de variante. */
function isZeroWidth(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    cp === 0x2060 ||
    cp === 0xfeff ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff) || // tonos de piel
    (cp >= 0xe0020 && cp <= 0xe007f)
  )
}

function isEmoji(cp: number): boolean {
  return (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff)
}

/** Estimaciones para lo que no está medido, por arriba: mejor que sobre caja que no que falte. */
const EMOJI_EM = 1.4
const OTHER_EM = 0.78

/** Ancho de un texto como `a + b·anchura` en cada mitad del eje, más lo que no depende de la anchura. */
interface Span {
  /** Suma de avances a 50, 100 y 150 % (em). */
  at: [number, number, number]
  /** Lo que no cambia con la anchura (em): CJK, emoji, estimados. */
  fixed: number
  /** Caracteres que ocupan: cada uno lleva el espaciado entre letras. */
  count: number
  exact: boolean
}

const EMPTY: Span = { at: [0, 0, 0], fixed: 0, count: 0, exact: true }

function measure(text: string): Span {
  const span: Span = { at: [0, 0, 0], fixed: 0, count: 0, exact: true }
  let joined = false
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp === 0x200d) {
      joined = true // lo que sigue a una unión forma parte del mismo dibujo
      continue
    }
    if (isZeroWidth(cp)) continue
    const known = table().get(cp)
    if (known) {
      span.at[0] += known[0]
      span.at[1] += known[1]
      span.at[2] += known[2]
      if (known[2] > 0) span.count++
    } else if (isWide(cp)) {
      span.fixed += 1
      span.count++
    } else if (isEmoji(cp)) {
      if (!joined) {
        span.fixed += EMOJI_EM
        span.count++
      }
      span.exact = false
    } else {
      span.fixed += OTHER_EM
      span.count++
      span.exact = false
    }
    joined = false
  }
  return span
}

function add(a: Span, b: Span): Span {
  return {
    at: [a.at[0] + b.at[0], a.at[1] + b.at[1], a.at[2] + b.at[2]],
    fixed: a.fixed + b.fixed,
    count: a.count + b.count,
    exact: a.exact && b.exact,
  }
}

/** Ancho en em de un tramo a una anchura dada, con el espaciado entre letras del rótulo. */
function widthAt(span: Span, stretch: number): number {
  const [lo, mid, hi] = span.at
  const variable = stretch <= 100 ? lo + ((mid - lo) * (stretch - 50)) / 50 : mid + ((hi - mid) * (stretch - 100)) / 50
  return Math.max(0, variable + span.fixed + span.count * LETTER_SPACING)
}

/**
 * Ancho de una línea de rótulo, en em, a una anchura del eje (50–150). Es un
 * tope: el interletraje de Anybody solo estrecha lo pintado.
 */
export function salaTitleLineWidth(text: string, stretch: number): number {
  return widthAt(measure(text.trim().replace(/\s+/g, ' ')), clampStretch(stretch))
}

const clampStretch = (value: number) =>
  Math.min(SALA_TITLE_STRETCH_MAX, Math.max(SALA_TITLE_STRETCH_MIN, Number.isFinite(value) ? value : 100))

// ------------------------------------------------------------
// La anchura que toca por longitud
// ------------------------------------------------------------

/** Puntos de la curva: [caracteres, anchura]. Del prototipo firmado, suavizada. */
const STRETCH_CURVE: ReadonlyArray<readonly [number, number]> = [
  [4, 135],
  [8, 118],
  [13, 100],
  [22, 85],
  [34, 72],
  [60, 60],
  [100, 50],
]

/**
 * Anchura del eje `wdth` de Anybody que le toca a un título por su longitud:
 * uno corto va ancho y uno largo, estrecho. Es el suelo del que parte el
 * rótulo; si a esa anchura no llena la caja, se ensancha hasta llenarla.
 * `scale` la estrecha para cajas estrechas (móvil, póster). Entero, 55–150.
 */
export function salaTitleStretch(title: string, scale = 1): number {
  const length = Array.from(title.trim().replace(/\s+/g, ' ')).length
  let value = STRETCH_CURVE[STRETCH_CURVE.length - 1][1]
  if (length <= STRETCH_CURVE[0][0]) value = STRETCH_CURVE[0][1]
  else {
    for (let i = 1; i < STRETCH_CURVE.length; i++) {
      const [x0, y0] = STRETCH_CURVE[i - 1]
      const [x1, y1] = STRETCH_CURVE[i]
      if (length <= x1) {
        value = y0 + ((y1 - y0) * (length - x0)) / (x1 - x0)
        break
      }
    }
  }
  return Math.round(clampStretch(value * scale))
}

// ------------------------------------------------------------
// Partir el título en trozos
// ------------------------------------------------------------

/** No puede empezar línea: cierres, puntuación y kana pequeña. */
const NO_START = /^[、。，．！？：；・ー々」』】）〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ!?,.:;)\]}»”’…]/
/** No puede acabar línea: aperturas. */
const NO_END = /[「『【（〈《(\[{«“‘¿¡]$/

type Script = 'hiragana' | 'katakana' | 'han' | 'hangul' | 'other'

function scriptOf(ch: string): Script {
  const cp = ch.codePointAt(0)!
  if (cp >= 0x3040 && cp <= 0x309f) return 'hiragana'
  if ((cp >= 0x30a0 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff) || (cp >= 0xff66 && cp <= 0xff9f)) return 'katakana'
  if ((cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f)) return 'hangul'
  if (cp === 0x3005 || (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x3134f)) return 'han'
  return 'other'
}

/**
 * ¿Empieza una palabra entre estos dos caracteres de un texto sin espacios?
 * En japonés, donde un tramo de hiragana (una partícula, una terminación) da
 * paso a kanji o katakana, y entre kanji y katakana: «千と|千尋の|神隠し». Dentro
 * de un tramo de kanji, de katakana o de hangul no se parte: son una palabra
 * («ベルセルク», «기생충»). Y entre esas escrituras y la latina.
 */
function wordBoundary(ch: string, next: string): boolean {
  const a = scriptOf(ch)
  const b = scriptOf(next)
  if (a === b) return false
  if (a === 'hiragana') return b === 'han' || b === 'katakana'
  if (a === 'katakana' || a === 'han') return b !== 'hiragana' && b !== 'other' ? true : b === 'other' && isLetterOrDigit(next)
  if (a === 'hangul') return b !== 'other' || isLetterOrDigit(next)
  // De la latina (letra o cifra) a cualquiera de las otras.
  return isLetterOrDigit(ch)
}

const isLetterOrDigit = (ch: string) => /\p{L}|\p{N}/u.test(ch)

interface Chunk {
  text: string
  join: '' | ' '
  span: Span
}

/**
 * Trozos que no se separan. Una palabra es un trozo; se puede partir después
 * de un guion y, en un texto sin espacios, donde empieza una palabra
 * (`wordBoundary`), nunca delante de un cierre ni detrás de una apertura. `limit` es el ancho máximo de un
 * trozo, en em y a la anchura mínima: uno más largo (una palabra que no cabe
 * ni al tamaño mínimo) se trocea por caracteres.
 */
function chunksOf(title: string, limit: number): Chunk[] {
  const out: Chunk[] = []
  const push = (text: string, join: '' | ' ') => {
    const span = measure(text)
    if (widthAt(span, SALA_TITLE_STRETCH_MIN) <= limit) {
      out.push({ text, join, span })
      return
    }
    // No cabe entera: a trozos, carácter a carácter.
    let piece = ''
    let first = true
    for (const ch of text) {
      const cp = ch.codePointAt(0)!
      const next = piece + ch
      const glued = cp === 0x200d || isZeroWidth(cp) || piece.endsWith('‍')
      if (piece !== '' && !glued && widthAt(measure(next), SALA_TITLE_STRETCH_MIN) > limit) {
        out.push({ text: piece, join: first ? join : '', span: measure(piece) })
        first = false
        piece = ch
      } else piece = next
    }
    if (piece !== '') out.push({ text: piece, join: first ? join : '', span: measure(piece) })
  }

  const words = title.trim().split(/\s+/).filter(Boolean)
  words.forEach((word, w) => {
    const pieces: string[] = []
    let current = ''
    const chars = Array.from(word)
    chars.forEach((ch, i) => {
      current += ch
      const next = chars[i + 1]
      if (next === undefined) return
      const afterHyphen = (ch === '-' || ch === '–' || ch === '/') && current.length > 1 && /\p{L}|\p{N}/u.test(next)
      if ((afterHyphen || wordBoundary(ch, next)) && !NO_START.test(next) && !NO_END.test(current)) {
        pieces.push(current)
        current = ''
      }
    })
    if (current !== '') pieces.push(current)
    pieces.forEach((piece, p) => push(piece, p === 0 && w > 0 ? ' ' : ''))
  })
  if (out.length > 0) out[0].join = ''
  return out
}

// ------------------------------------------------------------
// Componer
// ------------------------------------------------------------

const SPACE = measure(' ')

/** Tramos acumulados para medir cualquier línea [desde, hasta) sin recorrerla. */
function lineSpan(chunks: readonly Chunk[], from: number, to: number): Span {
  let span = EMPTY
  for (let i = from; i < to; i++) {
    if (i > from && chunks[i].join === ' ') span = add(span, SPACE)
    span = add(span, chunks[i].span)
  }
  return span
}

/** Una línea con una sola palabra de una o dos letras («de», «y») queda huérfana: se evita. */
function isOrphan(chunks: readonly Chunk[], from: number, to: number, total: number): boolean {
  if (total <= 1 || to - from !== 1) return false
  const chunk = chunks[from]
  const isolated = chunk.join === ' ' || from === 0
  const nextIsWord = to >= chunks.length || chunks[to].join === ' '
  return isolated && nextIsWord && Array.from(chunk.text).length <= 2 && chunk.span.fixed === 0
}

/**
 * Parte los trozos en `lines` líneas de forma que la más larga sea lo más
 * corta posible (y, a igualdad, las líneas más parejas). `null` si no se
 * puede sin dejar una línea huérfana (`orphans` las admite).
 */
function partition(chunks: readonly Chunk[], lines: number, stretch: number, orphans = false): number[] | null {
  const n = chunks.length
  if (lines > n) return null
  const width: number[][] = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i < n; i++) {
    let span = EMPTY
    for (let j = i; j < n; j++) {
      if (j > i && chunks[j].join === ' ') span = add(span, SPACE)
      span = add(span, chunks[j].span)
      width[i][j + 1] = widthAt(span, stretch)
    }
  }
  // best[l][i]: mejor forma de poner los trozos [i, n) en l líneas → [línea más larga, suma de cuadrados, dónde acaba la primera].
  const best: Array<Array<[number, number, number] | null>> = Array.from({ length: lines + 1 }, () => new Array(n + 1).fill(null))
  best[0][n] = [0, 0, n]
  for (let l = 1; l <= lines; l++) {
    for (let i = n - l; i >= 0; i--) {
      let pick: [number, number, number] | null = null
      for (let j = i + 1; j <= n - (l - 1); j++) {
        const rest = best[l - 1][j]
        if (!rest || (!orphans && isOrphan(chunks, i, j, lines))) continue
        const w = width[i][j]
        const longest = Math.max(w, rest[0])
        const ragged = w * w + rest[1]
        if (!pick || longest < pick[0] - 1e-9 || (Math.abs(longest - pick[0]) <= 1e-9 && ragged < pick[1])) pick = [longest, ragged, j]
      }
      best[l][i] = pick
    }
  }
  if (!best[lines][0]) return null
  const starts: number[] = []
  for (let i = 0, l = lines; l > 0; l--) {
    starts.push(i)
    i = best[l][i]![2]
  }
  return starts
}

const floor2 = (n: number) => Math.floor(n * 100) / 100

function solve(chunks: readonly Chunk[], starts: number[], floorStretch: number, rules: SalaTitleRules, leading: number): SalaTitleLayout {
  const spans = starts.map((from, i) => lineSpan(chunks, from, starts[i + 1] ?? chunks.length))
  const longestAt = (stretch: number) => Math.max(...spans.map((s) => widthAt(s, stretch)), 1e-6)
  const fillSize = (stretch: number) => (100 * (1 - SAFETY)) / longestAt(stretch)
  const cap = Math.min(rules.maxSize, rules.maxBlock / (starts.length * leading))

  let stretch = floorStretch
  if (fillSize(stretch) > cap) {
    // Le sobra caja a su anchura: se ensancha hasta llenarla al cuerpo máximo.
    let lo = stretch
    let hi = Math.min(SALA_TITLE_STRETCH_MAX, floorStretch + WIDEN)
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (fillSize(mid) >= cap) lo = mid
      else hi = mid - 1
    }
    stretch = lo
  }
  const size = floor2(Math.min(cap, fillSize(stretch)))
  const widths = spans.map((s) => widthAt(s, stretch))
  return { starts, stretch, size, widths, fill: (Math.max(...widths) * size) / 100, block: starts.length * leading * size }
}

function layout(chunks: readonly Chunk[], title: string, rules: SalaTitleRules, leading: number): SalaTitleLayout {
  if (chunks.length === 0) return { starts: [0], stretch: 100, size: floor2(rules.minSize), widths: [0], fill: 0, block: leading * rules.minSize }
  const floorStretch = salaTitleStretch(title, rules.stretchScale)
  let pick: SalaTitleLayout | null = null
  for (let lines = 1; lines <= Math.min(rules.maxLines, chunks.length); lines++) {
    const starts = partition(chunks, lines, floorStretch)
    if (!starts) continue
    const candidate = solve(chunks, starts, floorStretch, rules, leading)
    if (!pick || candidate.size >= pick.size * LINE_GAIN) pick = candidate
  }
  if (pick && pick.size >= rules.minSize) return pick

  // No cabe al tamaño mínimo: a la anchura más estrecha y con las líneas que hagan falta.
  const open: SalaTitleRules = { ...rules, maxBlock: Infinity }
  for (let lines = 1; lines <= Math.min(rules.maxLines + OVERFLOW_LINES, chunks.length); lines++) {
    const starts = partition(chunks, lines, SALA_TITLE_STRETCH_MIN) ?? partition(chunks, lines, SALA_TITLE_STRETCH_MIN, true) ?? [0]
    const candidate = solve(chunks, starts, SALA_TITLE_STRETCH_MIN, open, leading)
    if (!pick || candidate.size > pick.size) pick = candidate
    if (candidate.size >= rules.minSize) return candidate
  }
  return pick!
}

/**
 * Compone un título: por dónde se parte, con qué anchura y a qué tamaño, en
 * la caja estrecha y en la ancha. Solo depende del texto y del `preset`.
 */
export function planSalaTitle(title: string, preset: SalaTitlePreset = SALA_TITLE_PRESET.sala): SalaTitlePlan {
  const clean = title.trim().replace(/\s+/g, ' ')
  // Un trozo cabe en una línea al tamaño mínimo de la composición más exigente.
  // El mínimo se redondea hacia arriba a centésimas: el cuerpo se redondea hacia
  // abajo (`floor2`) y así un trozo al límite sigue sin bajar del mínimo.
  const limit = (100 * (1 - SAFETY)) / (Math.ceil(Math.max(preset.narrow.minSize, preset.wide.minSize) * 100) / 100)
  const chunks = chunksOf(clean, limit)
  const leading = Array.from(clean).some((ch) => scriptOf(ch) !== 'other') ? SALA_TITLE_CJK_LINE_HEIGHT : LINE_HEIGHT
  return {
    chunks: chunks.map((c) => c.text),
    joins: chunks.map((c) => c.join),
    narrow: layout(chunks, clean, preset.narrow, leading),
    wide: layout(chunks, clean, preset.wide, leading),
    exact: chunks.every((c) => c.span.exact),
    lineHeight: leading,
  }
}

/** Qué composición vale para una caja de `boxPx` píxeles (`rootPx`: el tamaño de texto del navegador). */
export function salaTitleLayoutFor(plan: SalaTitlePlan, boxPx: number, rootPx = 16): SalaTitleLayout {
  return boxPx >= SALA_TITLE_WIDE_FROM_REM * rootPx ? plan.wide : plan.narrow
}

/** Cuerpo en píxeles de una composición en una caja de `boxPx` píxeles. */
export function salaTitleSizePx(layout: SalaTitleLayout, boxPx: number): number {
  return (layout.size * boxPx) / 100
}

/** Las líneas de una composición, como texto. */
export function salaTitleLines(plan: SalaTitlePlan, layout: SalaTitleLayout): string[] {
  return layout.starts.map((from, i) => {
    const to = layout.starts[i + 1] ?? plan.chunks.length
    let line = ''
    for (let c = from; c < to; c++) line += (c > from ? plan.joins[c] : '') + plan.chunks[c]
    return line
  })
}

// ------------------------------------------------------------
// Escrituras: qué fuentes hacen falta
// ------------------------------------------------------------

/** Escrituras con hoja de fuentes propia (`fonts-jp.css`, `fonts-kr.css`). */
export type SalaScript = 'jp' | 'kr'

/**
 * Qué hojas de fuentes necesita un texto: la japonesa si lleva kana o
 * ideogramas, la coreana si lleva hangul (o ideogramas marcados como
 * coreano). Un texto latino no necesita ninguna.
 */
export function salaScripts(...texts: Array<{ text: string; lang?: string } | string | null | undefined>): SalaScript[] {
  const found = new Set<SalaScript>()
  for (const entry of texts) {
    if (!entry) continue
    const { text, lang } = typeof entry === 'string' ? { text: entry, lang: undefined } : entry
    for (const ch of text) {
      const script = scriptOf(ch)
      if (script === 'hangul') found.add('kr')
      else if (script === 'hiragana' || script === 'katakana') found.add('jp')
      else if (script === 'han') found.add(lang?.toLowerCase().startsWith('ko') ? 'kr' : 'jp')
    }
  }
  return (['jp', 'kr'] as const).filter((s) => found.has(s))
}
