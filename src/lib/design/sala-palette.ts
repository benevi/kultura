// ============================================================
// KULTURA — «Sala»: la paleta de una obra como variables CSS
// ------------------------------------------------------------
// Los componentes de «Sala» pintan con las variables `--sala-*` (papeles de la
// biblia, §4). Fuera de una obra valen los neutros del tema; dentro de un
// contenedor con la clase `sala-work`, valen los de la paleta sacada de su
// imagen (`image-palette.ts`).
//
// El contenedor recibe los papeles de los DOS temas (`--sala-work-light-*` y
// `--sala-work-dark-*`) y es el CSS quien elige (`src/styles/sala/tokens.css`):
// así el servidor no necesita saber el tema y no hay salto al hidratar. Si la
// paleta todavía no ha llegado, el contenedor se queda en los neutros.
//
// Este archivo es lo único de los tokens que llega al navegador: nombres y una
// función, sin cálculo.
// ============================================================

import type { ImagePalette, ThemePalette } from './image-palette'

export const SALA_MODES = ['light', 'dark'] as const
export type SalaMode = (typeof SALA_MODES)[number]

export type SalaRole = keyof ThemePalette

/**
 * Un papel por clave de `ThemePalette`: si a la paleta le sale un papel nuevo
 * (o se le quita uno), esto deja de compilar hasta que se ponga al día.
 */
const ROLE_ORDER: Record<SalaRole, true> = {
  background: true,
  panel: true,
  ink: true,
  inkSecondary: true,
  accent: true,
  accentInk: true,
  band: true,
  bandInk: true,
  border: true,
}

/** Los papeles de la biblia, en el orden en que se documentan. */
export const SALA_ROLES = Object.keys(ROLE_ORDER) as readonly SalaRole[]

/** `inkSecondary` → `ink-secondary`. */
export const kebab = (name: string) => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)

/** Variable que leen los componentes: `--sala-ink-secondary`. */
export const salaVar = (token: string) => `--sala-${kebab(token)}`

/** Variable con la que una obra da su papel para un tema: `--sala-work-light-band`. */
export const salaWorkVar = (mode: SalaMode, role: SalaRole) => `--sala-work-${mode}-${kebab(role)}`

/** Clase del contenedor de una obra: dentro de él, los papeles salen de su paleta. */
export const SALA_WORK_CLASS = 'sala-work'

/**
 * Variables CSS con la paleta de una obra, para el `style` del contenedor que
 * lleva la clase `sala-work`:
 *
 *   <article className="sala-work" style={workPaletteVars(palette)}>
 *
 * La paleta sale de `paletteFromPixels` y ya cumple AA en claro y en oscuro.
 */
export function workPaletteVars(palette: ImagePalette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const mode of SALA_MODES) {
    for (const role of SALA_ROLES) vars[salaWorkVar(mode, role)] = palette[mode][role]
  }
  return vars
}

/**
 * La paleta que lleva puesta un contenedor `sala-work` (la que le dio
 * `workPaletteVars`), leída de su `style`. Para lo que cuelga de `<body>`
 * (un diálogo) y tiene que llevar los colores de la obra consigo. Sin paleta
 * completa (aún no ha llegado, o la imagen dio la neutra), `undefined`: los
 * neutros del tema.
 */
export function paletteFromElement(el: HTMLElement | null | undefined): ImagePalette | undefined {
  if (!el) return undefined
  const read = (mode: SalaMode): ThemePalette | undefined => {
    const out = {} as Record<SalaRole, string>
    for (const role of SALA_ROLES) {
      const value = el.style.getPropertyValue(salaWorkVar(mode, role)).trim()
      if (!value) return undefined
      out[role] = value
    }
    return out as ThemePalette
  }
  const light = read('light')
  const dark = read('dark')
  return light && dark ? { neutral: false, light, dark } : undefined
}
