// ============================================================
// KULTURA — Tokens de «Sala» (fuente de verdad)
// ------------------------------------------------------------
// Biblia de diseño (`docs/design/BIBLIA.md`). De aquí salen:
// - `src/styles/sala/tokens.css`, generado (`npm run tokens:sala`);
//   `tests/unit/design/sala-tokens-css.test.ts` falla si el archivo no coincide;
// - las clases de Tailwind `*-sala-*` (`tailwind.config.ts`);
// - la página «Sala/Fundamentos» de Storybook y `docs/design/TOKENS.md`.
//
// Ningún valor se escribe a mano en otro sitio. Este módulo solo se usa al
// construir y en los tests: al navegador llega `sala-palette.ts`.
//
// Conviven con los tokens de la app de hoy (`--surface-*`, `--text-*`…), que
// no cambian: todo lo de aquí lleva el prefijo `sala`.
// ============================================================

import { contrastRatio, parseHex, toHex, type Rgb } from './color'
import { fillWithInk, NEUTRAL_PALETTE } from './image-palette'
import { kebab, SALA_ROLES, SALA_WORK_CLASS, salaVar, salaWorkVar, type SalaMode } from './sala-palette'

// ------------------------------------------------------------
// 1. Color
// ------------------------------------------------------------

/** Estados que necesitan los componentes. La biblia no los fija: son propuesta. */
export const SALA_STATES = ['danger', 'success', 'warning'] as const
export type SalaState = (typeof SALA_STATES)[number]

/**
 * Matiz y croma (OKLCH) de cada estado. La luminosidad no se escribe: se
 * busca hasta cumplir contraste, igual que el acento de una obra.
 */
const STATE_SEED: Record<SalaState, { h: number; c: number }> = {
  danger: { h: 27, c: 0.19 },
  success: { h: 150, c: 0.14 },
  warning: { h: 70, c: 0.13 },
}

/**
 * Contraste que se pide a un estado contra el fondo y el panel NEUTROS. Los
 * estados no cambian con la obra, y el panel teñido de una obra puede ser algo
 * más oscuro (en claro) que el neutro: con 5:1 aquí, sobre cualquier fondo o
 * panel de obra queda por encima de 4,5:1 (lo barre el test).
 */
export const STATE_CONTRAST_ON_NEUTRAL = 5

const rgb = (hex: string): Rgb => parseHex(hex) as Rgb

function buildStates(mode: SalaMode): Record<string, string> {
  const light = mode === 'light'
  const surfaces = [rgb(NEUTRAL_PALETTE[mode].background), rgb(NEUTRAL_PALETTE[mode].panel)]
  const out: Record<string, string> = {}
  for (const state of SALA_STATES) {
    const seed = STATE_SEED[state]
    // Como el acento: vale de texto sobre fondo y panel, y de relleno con su tinta encima.
    const { fill, ink } = fillWithInk(
      { l: light ? 0.55 : 0.75, c: light ? seed.c : seed.c * 0.85, h: seed.h },
      { min: 0, max: 1 },
      light ? 'darker' : 'lighter',
      (candidate) => surfaces.every((s) => contrastRatio(candidate, s) >= STATE_CONTRAST_ON_NEUTRAL),
    )
    out[state] = toHex(fill)
    out[`${state}Ink`] = toHex(ink)
  }
  return out
}

/**
 * Colores con valor propio en cada tema: los nueve papeles de la biblia (con
 * los neutros de `NEUTRAL_PALETTE`) y los estados.
 */
export const SALA_COLOR: Record<SalaMode, Record<string, string>> = {
  light: { ...NEUTRAL_PALETTE.light, ...buildStates('light') },
  dark: { ...NEUTRAL_PALETTE.dark, ...buildStates('dark') },
}

/**
 * Colores que son otro token con otro nombre. No tienen valor propio, así que
 * dentro de una obra siguen a su paleta sin hacer nada.
 * - `focus`: el anillo de foco es la tinta (≥ 7:1 sobre fondo y panel). Sobre
 *   la franja, el componente usa `band-ink`.
 * - `inkDisabled`: texto de un control deshabilitado, el gris del borde
 *   (≥ 3:1). WCAG no exige contraste a lo deshabilitado; se le da igualmente.
 */
export const SALA_COLOR_ALIAS: Record<string, string> = {
  focus: 'ink',
  inkDisabled: 'border',
}

/** Todos los nombres de color, para Tailwind y para la documentación. */
export const SALA_COLOR_NAMES: readonly string[] = [...Object.keys(SALA_COLOR.light), ...Object.keys(SALA_COLOR_ALIAS)]

// ------------------------------------------------------------
// 2. Tipografía
// ------------------------------------------------------------

/** Nombres de familia de los `@font-face` de `src/styles/sala/fonts*.css`. */
export const SALA_FAMILY = {
  display: 'Anybody',
  /** Respaldo de Anybody con métricas ajustadas (`src/styles/sala/title.css`). Donde no se carga esa hoja, se salta. */
  displayFallback: 'Anybody Fallback',
  text: 'Instrument Sans',
  jp: 'Noto Sans JP',
  kr: 'Noto Sans KR',
} as const

const stack = (first: readonly string[], cjk: readonly string[]) =>
  [...first, ...cjk].map((f) => `"${f}"`).join(', ') + ', system-ui, sans-serif'

const DISPLAY = [SALA_FAMILY.display, SALA_FAMILY.displayFallback]
const JP_FIRST = [SALA_FAMILY.jp, SALA_FAMILY.kr]
const KR_FIRST = [SALA_FAMILY.kr, SALA_FAMILY.jp]

/**
 * Pilas de fuentes (biblia, §5). Por defecto va primero la japonesa; en texto
 * marcado como coreano (`lang="ko"`), la coreana. El hangul no está en la
 * japonesa, así que sin marca también cae en la coreana; la marca decide con
 * qué trazo salen los caracteres chinos que comparten.
 */
export const SALA_FONT = {
  display: { default: stack(DISPLAY, JP_FIRST), ko: stack(DISPLAY, KR_FIRST) },
  text: { default: stack([SALA_FAMILY.text], JP_FIRST), ko: stack([SALA_FAMILY.text], KR_FIRST) },
} as const

export interface SalaTypeRole {
  /** Qué pila usa. */
  font: keyof typeof SALA_FONT
  weight: number
  /** Eje de anchura de Anybody (50–150 %). */
  stretch?: string
  size?: string
  lineHeight: string
  letterSpacing?: string
  /** Para qué es (documentación). */
  use: string
}

/**
 * Papeles tipográficos. La biblia fija las familias y que el rótulo llena el
 * ancho; tamaños, pesos e interlineados son los del prototipo que Víctor
 * firmó (rama `proto/fase8-3-direcciones`), pasados a `rem`: son propuesta.
 * Cada papel es una clase `sala-type-<papel>` (`tailwind.config.ts`).
 */
const TYPE_ROLES = {
  title: {
    font: 'display',
    weight: 800,
    lineHeight: '0.9',
    letterSpacing: '-0.025em',
    use: 'Rótulo: el título de la obra. El tamaño y la anchura los pone el componente según la longitud del título',
  },
  heading: {
    font: 'display',
    weight: 800,
    stretch: '88%',
    // Mínimo 30 px en el móvil (decisión de Víctor del 25-11-2026; antes, 26).
    size: 'clamp(1.875rem, 3vw, 2.5rem)',
    lineHeight: '1',
    letterSpacing: '-0.02em',
    use: 'Título de sección',
  },
  data: {
    font: 'display',
    weight: 700,
    size: '1.375rem',
    lineHeight: '1.2',
    use: 'Dato destacado (año, duración, nota)',
  },
  lead: {
    font: 'text',
    weight: 400,
    size: 'clamp(1.125rem, 1.45vw, 1.3125rem)',
    lineHeight: '1.55',
    use: 'Sinopsis y texto de lectura',
  },
  text: { font: 'text', weight: 400, size: '1.0625rem', lineHeight: '1.5', use: 'Texto de interfaz' },
  label: { font: 'text', weight: 600, size: '0.9375rem', lineHeight: '1.2', use: 'Botones, pestañas y campos' },
  small: { font: 'text', weight: 500, size: '0.875rem', lineHeight: '1.3', use: 'Etiquetas de dato y notas. No hay texto más pequeño' },
} satisfies Record<string, SalaTypeRole>

/** Nombres de los papeles: quien los recorre (la historia, los tests) no puede dejarse uno. */
export type SalaTypeName = keyof typeof TYPE_ROLES
export const SALA_TYPE: Record<SalaTypeName, SalaTypeRole> = TYPE_ROLES

// ------------------------------------------------------------
// 3. Medidas y movimiento
// ------------------------------------------------------------

/**
 * Medidas. La biblia fija esquinas rectas, sin sombras (§1) y acciones de
 * 48 px o más (§9); el resto son los valores del prototipo firmado y van como
 * propuesta. El espacio entre elementos usa la escala de Tailwind (múltiplos
 * de 4 px): no hay tokens de espacio propios.
 */
export const SALA_SIZE = {
  /** Alto y ancho mínimos de una acción (biblia, §9). */
  target: '48px',
  /** Margen lateral de página. Propuesta (prototipo). */
  margin: 'clamp(16px, 4vw, 56px)',
  /** Grosor del anillo de foco y su separación. Propuesta (prototipo). */
  focusWidth: '3px',
  focusOffset: '3px',
} as const

/** Pasos de espacio recomendados, en px (escala de Tailwind). Propuesta. */
export const SALA_SPACE_STEPS = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const

/** Movimiento. La biblia (§6) no da tiempos: son los del prototipo. Propuesta. */
export const SALA_MOTION = {
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Respuesta de un control (pasar el ratón, pulsar). */
  durationFast: '150ms',
  /** Cambio de color de la franja y entradas. */
  durationSlow: '500ms',
} as const

// ------------------------------------------------------------
// 4. CSS
// ------------------------------------------------------------

const declarations = (pairs: Iterable<readonly [string, string]>) =>
  Array.from(pairs, ([name, value]) => `  ${name}: ${value};`).join('\n')

function themeBlock(selector: string, mode: SalaMode): string {
  const other = mode === 'light' ? 'dark' : 'light'
  return `${selector} {
  color-scheme: ${mode};
  /* Interruptores para .${SALA_WORK_CLASS}: «initial» deja pasar el valor de este tema; el vacío lo anula. */
  --sala-on-${mode}: initial;
  --sala-on-${other}: ;
${declarations(Object.entries(SALA_COLOR[mode]).map(([name, hex]) => [salaVar(name), hex] as const))}
${declarations(Object.entries(SALA_COLOR_ALIAS).map(([name, target]) => [salaVar(name), `var(${salaVar(target)})`] as const))}
}`
}

/**
 * La hoja de tokens. `followSystem` añade el bloque que sigue al sistema
 * cuando `<html>` no lleva `data-theme` (biblia, §4: «por defecto, el del
 * sistema»). Hoy va apagado: la app es oscura y el selector llega en la 8.5.
 */
export function salaTokensCss({ followSystem = false } = {}): string {
  const fixed = declarations([
    [salaVar('fontDisplay'), SALA_FONT.display.default],
    [salaVar('fontText'), SALA_FONT.text.default],
    ...Object.entries(SALA_SIZE).map(([name, value]) => [salaVar(name), value] as const),
    ...Object.entries(SALA_MOTION).map(([name, value]) => [salaVar(name), value] as const),
  ])
  const work = declarations([
    ...SALA_ROLES.map((role) => {
      const pick = (mode: SalaMode) =>
        `var(--sala-on-${mode}, var(${salaWorkVar(mode, role)}, ${SALA_COLOR[mode][role]}))`
      return [salaVar(role), `${pick('light')} ${pick('dark')}`] as const
    }),
    ...Object.entries(SALA_COLOR_ALIAS).map(([name, target]) => [salaVar(name), `var(${salaVar(target)})`] as const),
  ])

  return `/* GENERADO desde src/lib/design/sala-tokens.ts. No editar: npm run tokens:sala */

/* Lo que no cambia con el tema. */
:root {
${fixed}
}

/* Biblia §5: en coreano va primero la fuente coreana. */
:lang(ko) {
${declarations([
  [salaVar('fontDisplay'), SALA_FONT.display.ko],
  [salaVar('fontText'), SALA_FONT.text.ko],
])}
}

/* Otro idioma marcado dentro de un texto coreano vuelve al orden por defecto. */
[lang]:not(:lang(ko)) {
${declarations([
  [salaVar('fontDisplay'), SALA_FONT.display.default],
  [salaVar('fontText'), SALA_FONT.text.default],
])}
}

/* Tema: data-theme en <html> (o en cualquier contenedor). Sin atributo, oscuro. */
${themeBlock(':root,\n[data-theme="dark"]', 'dark')}

${themeBlock('[data-theme="light"]', 'light')}
${
  followSystem
    ? `
/* Sin data-theme manda el sistema. */
@media (prefers-color-scheme: light) {
${themeBlock(':root:not([data-theme])', 'light').replace(/^/gm, '  ')}
}
`
    : ''
}
/* Una obra: los papeles salen de su paleta (workPaletteVars) y, si aún no ha
   llegado, de los neutros. El tema lo eligen los interruptores de arriba. Un
   data-theme dentro de la obra cambia de tema sin perder su paleta: sin la
   segunda línea, su bloque de tema volvería a poner los neutros. */
.${SALA_WORK_CLASS},
.${SALA_WORK_CLASS} [data-theme] {
${work}
}
`
}

// ------------------------------------------------------------
// 5. Tailwind
// ------------------------------------------------------------

/** Declaraciones CSS de un papel tipográfico (clase `sala-type-<papel>`). */
export function salaTypeStyles(): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(SALA_TYPE).map(([name, role]) => [
      `.sala-type-${kebab(name)}`,
      {
        fontFamily: `var(${salaVar(role.font === 'display' ? 'fontDisplay' : 'fontText')})`,
        fontWeight: String(role.weight),
        ...(role.stretch ? { fontStretch: role.stretch } : {}),
        ...(role.size ? { fontSize: role.size } : {}),
        lineHeight: role.lineHeight,
        ...(role.letterSpacing ? { letterSpacing: role.letterSpacing } : {}),
      },
    ]),
  )
}
