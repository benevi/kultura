// ============================================================
// KULTURA — Avatares de personaje (E-AVATAR-ICONS)
//
// Cada personaje es un avatar COMPLETO, no un glifo: trae su propio disco con
// degradado, su luz especular y sus colores. La primera versión los pintaba en
// `currentColor` sobre el color de avatar del usuario, y el resultado era una
// fila de doce círculos idénticos donde no se distinguía ni el personaje ni uno
// de otro — justo lo contrario de elegir una cara.
//
// Volumen sin salirse del sistema (CLAUDE.md): el disco usa un degradado radial
// de TRES paradas del MISMO matiz (clara arriba-izquierda → token → oscura
// abajo-derecha), que es la fórmula de poster llevada a redondo, más un brillo
// blanco a baja opacidad. Ninguna sombra CSS nueva y ningún matiz fuera de la
// paleta OKLCH: pink 350, lime 130, orange 55, purple 300, blue 250, yellow 95.
//
// Los mismos avatares sirven para los grupos: un grupo es otra identidad que
// necesita cara, y duplicar el set solo daría dos catálogos que mantener.
// ============================================================

import type { SVGProps } from 'react'

export type AvatarIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element

// Tonos compartidos: el claro para cuerpos/caras y el oscuro para los rasgos.
// Son los mismos `--text` y "on-color" del sistema, no grises nuevos.
const LIGHT = 'oklch(97% 0.004 280)'
const INK = 'oklch(20% 0.03 280)'

/** Paleta de cada personaje: las tres paradas del disco, del mismo matiz. */
interface Hue {
  light: string
  base: string
  dark: string
}

const HUES = {
  pink: { light: 'oklch(80% 0.20 350)', base: 'oklch(68% 0.24 350)', dark: 'oklch(46% 0.18 350)' },
  lime: { light: 'oklch(92% 0.19 130)', base: 'oklch(83% 0.24 130)', dark: 'oklch(58% 0.18 130)' },
  orange: { light: 'oklch(84% 0.15 55)', base: 'oklch(72% 0.19 55)', dark: 'oklch(50% 0.15 55)' },
  purple: { light: 'oklch(76% 0.16 300)', base: 'oklch(62% 0.19 300)', dark: 'oklch(40% 0.15 300)' },
  blue: { light: 'oklch(80% 0.13 250)', base: 'oklch(68% 0.16 250)', dark: 'oklch(45% 0.13 250)' },
  yellow: { light: 'oklch(93% 0.14 95)', base: 'oklch(85% 0.17 95)', dark: 'oklch(62% 0.14 95)' },
} satisfies Record<string, Hue>

const svgProps = {
  viewBox: '0 0 48 48',
  xmlns: 'http://www.w3.org/2000/svg',
} as const

/**
 * Disco de fondo con volumen + brillo. `id` lo hace único por personaje; que se
 * repita entre instancias del MISMO personaje es inocuo (los degradados son
 * idénticos y el navegador resuelve al primero).
 */
function Disc({ id, hue }: { id: string; hue: Hue }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-disc`} cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor={hue.light} />
          <stop offset="52%" stopColor={hue.base} />
          <stop offset="100%" stopColor={hue.dark} />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill={`url(#${id}-disc)`} />
      <ellipse cx="17" cy="11" rx="11" ry="7" fill="#fff" opacity="0.2" />
    </>
  )
}

export const AvatarAstronaut: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-astro" hue={HUES.blue} />
    <defs>
      <linearGradient id="k-astro-visor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="oklch(52% 0.14 250)" />
        <stop offset="100%" stopColor="oklch(26% 0.08 250)" />
      </linearGradient>
    </defs>
    <path d="M22 10.5h4v4h-4z" fill={LIGHT} />
    <circle cx="24" cy="9" r="2.5" fill={HUES.lime.base} />
    <circle cx="24" cy="26" r="14" fill={LIGHT} />
    <rect x="14" y="20" width="20" height="13" rx="6.5" fill="url(#k-astro-visor)" />
    <path d="M17.5 23.5c1.4-1.6 3.6-2.4 5.6-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" fill="none" />
    <circle cx="29.5" cy="29" r="1.6" fill="#fff" opacity="0.35" />
  </svg>
)

export const AvatarRobot: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-robot" hue={HUES.purple} />
    <path d="M23 8h2v5h-2z" fill={LIGHT} />
    <circle cx="24" cy="7.5" r="2.6" fill={HUES.lime.base} />
    <rect x="11" y="13" width="26" height="24" rx="8" fill={LIGHT} />
    <circle cx="18.5" cy="23" r="3.4" fill={HUES.lime.base} />
    <circle cx="29.5" cy="23" r="3.4" fill={HUES.lime.base} />
    <circle cx="17.6" cy="21.9" r="1.1" fill="#fff" opacity="0.8" />
    <circle cx="28.6" cy="21.9" r="1.1" fill="#fff" opacity="0.8" />
    <rect x="17" y="30" width="14" height="3.4" rx="1.7" fill={INK} />
    <rect x="7.5" y="20" width="3.5" height="9" rx="1.7" fill={LIGHT} opacity="0.85" />
    <rect x="37" y="20" width="3.5" height="9" rx="1.7" fill={LIGHT} opacity="0.85" />
  </svg>
)

export const AvatarCat: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-cat" hue={HUES.orange} />
    <path d="M11 12.5 16.5 20h-5.5zM37 12.5 31.5 20h5.5z" fill={LIGHT} />
    <path d="M12.5 14.5 16 19h-3.5zM35.5 14.5 32 19h3.5z" fill={HUES.pink.light} />
    <circle cx="24" cy="26" r="13" fill={LIGHT} />
    <ellipse cx="19" cy="24" rx="2.1" ry="2.9" fill={INK} />
    <ellipse cx="29" cy="24" rx="2.1" ry="2.9" fill={INK} />
    <path d="M24 29.2 21.9 31h4.2z" fill={HUES.pink.base} />
    <path d="M8.5 25h6M8.5 29h6M33.5 25h6M33.5 29h6" stroke={LIGHT} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
  </svg>
)

export const AvatarNinja: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-ninja" hue={HUES.blue} />
    <circle cx="24" cy="25" r="14" fill={INK} />
    <path d="M10.5 22.5h27v7h-27z" fill={LIGHT} />
    <ellipse cx="18.5" cy="26" rx="2.3" ry="2.6" fill={INK} />
    <ellipse cx="29.5" cy="26" rx="2.3" ry="2.6" fill={INK} />
    <path d="M37 22.5h6l-2.5 3.5 2.5 3.5h-6z" fill={HUES.pink.base} />
  </svg>
)

export const AvatarAlien: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-alien" hue={HUES.lime} />
    <path d="M24 10c8.6 0 14 5.2 14 12.2 0 7.6-6.6 15.8-14 15.8s-14-8.2-14-15.8C10 15.2 15.4 10 24 10Z" fill={LIGHT} />
    <ellipse cx="17.5" cy="23" rx="4.6" ry="6" fill={INK} transform="rotate(18 17.5 23)" />
    <ellipse cx="30.5" cy="23" rx="4.6" ry="6" fill={INK} transform="rotate(-18 30.5 23)" />
    <ellipse cx="16" cy="20.5" rx="1.5" ry="2" fill="#fff" opacity="0.6" transform="rotate(18 16 20.5)" />
    <path d="M21 32.5h6" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export const AvatarGhost: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-ghost" hue={HUES.purple} />
    <path d="M24 9c7.7 0 13 5.6 13 13.4V39l-4.3-3.3-4.3 3.3-4.4-3.3L19.6 39l-4.3-3.3L11 39V22.4C11 14.6 16.3 9 24 9Z" fill={LIGHT} />
    <ellipse cx="19" cy="22" rx="2.6" ry="3.3" fill={INK} />
    <ellipse cx="29" cy="22" rx="2.6" ry="3.3" fill={INK} />
    <ellipse cx="24" cy="29" rx="2.6" ry="2" fill={INK} opacity="0.8" />
  </svg>
)

export const AvatarOwl: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-owl" hue={HUES.yellow} />
    <path d="M11 14.5 17 19l-3.5 2zM37 14.5 31 19l3.5 2z" fill={HUES.orange.dark} />
    <path d="M24 11c8 0 13.5 5.6 13.5 13.2S32 39 24 39s-13.5-6.2-13.5-14.8S16 11 24 11Z" fill={HUES.orange.base} />
    <circle cx="18.2" cy="23" r="6.2" fill={LIGHT} />
    <circle cx="29.8" cy="23" r="6.2" fill={LIGHT} />
    <circle cx="18.2" cy="23" r="2.9" fill={INK} />
    <circle cx="29.8" cy="23" r="2.9" fill={INK} />
    <circle cx="17.2" cy="21.9" r="1" fill="#fff" opacity="0.9" />
    <circle cx="28.8" cy="21.9" r="1" fill="#fff" opacity="0.9" />
    <path d="M24 28.5 21 32h6z" fill={HUES.yellow.base} />
  </svg>
)

export const AvatarFox: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-fox" hue={HUES.orange} />
    <path d="M10 11 19 19l-7 2zM38 11 29 19l7 2z" fill={HUES.orange.dark} />
    <path d="M12.5 14 17.6 18.6l-3.9 1.1zM35.5 14 30.4 18.6l3.9 1.1z" fill={HUES.pink.light} />
    <path d="M24 13c7.6 0 12.8 4.8 12.8 11.6C36.8 32.6 30.8 39 24 39s-12.8-6.4-12.8-14.4C11.2 17.8 16.4 13 24 13Z" fill={HUES.orange.light} />
    <path d="M24 26c4.6 0 8 3.2 8 7 0 3.6-3.6 6-8 6s-8-2.4-8-6c0-3.8 3.4-7 8-7Z" fill={LIGHT} />
    <ellipse cx="18.5" cy="23" rx="2.2" ry="2.7" fill={INK} />
    <ellipse cx="29.5" cy="23" rx="2.2" ry="2.7" fill={INK} />
    <ellipse cx="24" cy="31" rx="2.4" ry="1.8" fill={INK} />
  </svg>
)

export const AvatarDragon: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-dragon" hue={HUES.lime} />
    {/* Cuernos grandes y crestas: es lo que lo separa de "otro animal redondo". */}
    <path d="M10.5 7 18 16.5l-6-2.5zM37.5 7 30 16.5l6-2.5z" fill={HUES.yellow.base} />
    <path d="M24 13c7.6 0 12.6 4.8 12.6 11.4C36.6 32.4 31 39 24 39s-12.6-6.6-12.6-14.6C11.4 17.8 16.4 13 24 13Z" fill={HUES.lime.light} />
    <path d="M20.5 10.5 24 6l3.5 4.5zM15 12l2.5-3.5L20 12z" fill={HUES.yellow.base} opacity="0.9" />
    <ellipse cx="18.4" cy="22.5" rx="2.4" ry="3.1" fill={INK} />
    <ellipse cx="29.6" cy="22.5" rx="2.4" ry="3.1" fill={INK} />
    <circle cx="17.6" cy="21.4" r="0.9" fill="#fff" opacity="0.85" />
    <circle cx="28.8" cy="21.4" r="0.9" fill="#fff" opacity="0.85" />
    <path d="M24 28c3.8 0 6.6 2.3 6.6 5.2 0 2.8-3 4.8-6.6 4.8s-6.6-2-6.6-4.8c0-2.9 2.8-5.2 6.6-5.2Z" fill={HUES.lime.dark} opacity="0.55" />
    <ellipse cx="21.4" cy="31.6" rx="1.2" ry="1.5" fill={INK} />
    <ellipse cx="26.6" cy="31.6" rx="1.2" ry="1.5" fill={INK} />
    <path d="M19.5 35.5c1.6 1.6 7.4 1.6 9 0" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
)

export const AvatarOctopus: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-octo" hue={HUES.pink} />
    <path d="M24 9c8.3 0 14 5.7 14 13.4V29H10v-6.6C10 14.7 15.7 9 24 9Z" fill={HUES.pink.light} />
    <path d="M10 29h6v7.5a3 3 0 0 1-6 0Zm8 0h6v9.5a3 3 0 0 1-6 0Zm8 0h6v9.5a3 3 0 0 1-6 0Zm8 0h6v7.5a3 3 0 0 1-6 0Z" fill={HUES.pink.light} />
    <circle cx="18.5" cy="21" r="4.6" fill={LIGHT} />
    <circle cx="29.5" cy="21" r="4.6" fill={LIGHT} />
    <circle cx="18.5" cy="21.4" r="2.2" fill={INK} />
    <circle cx="29.5" cy="21.4" r="2.2" fill={INK} />
    <circle cx="17.6" cy="20.3" r="0.9" fill="#fff" opacity="0.9" />
    <circle cx="28.6" cy="20.3" r="0.9" fill="#fff" opacity="0.9" />
  </svg>
)

export const AvatarPanda: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-panda" hue={HUES.blue} />
    <circle cx="13.5" cy="14.5" r="5.5" fill={INK} />
    <circle cx="34.5" cy="14.5" r="5.5" fill={INK} />
    <circle cx="24" cy="25" r="14" fill={LIGHT} />
    <ellipse cx="18" cy="23" rx="4.6" ry="5.4" fill={INK} transform="rotate(-12 18 23)" />
    <ellipse cx="30" cy="23" rx="4.6" ry="5.4" fill={INK} transform="rotate(12 30 23)" />
    <circle cx="18.4" cy="23.4" r="1.7" fill={LIGHT} />
    <circle cx="29.6" cy="23.4" r="1.7" fill={LIGHT} />
    <ellipse cx="24" cy="30.5" rx="2.6" ry="1.9" fill={INK} />
  </svg>
)

export const AvatarWizard: AvatarIcon = (props) => (
  <svg {...svgProps} {...props}>
    <Disc id="k-wizard" hue={HUES.pink} />
    <path d="M24 5 36 22H12z" fill={HUES.purple.base} />
    <path d="M24 5 30 22H18z" fill={HUES.purple.light} opacity="0.7" />
    <path d="M12 20.5h24v4H12z" fill={HUES.yellow.base} />
    <path d="m30.5 10.5 1 2.4 2.5.2-1.9 1.7.6 2.5-2.2-1.4-2.2 1.4.6-2.5-1.9-1.7 2.5-.2z" fill={HUES.yellow.base} />
    {/* Cara en tono cálido y barba en blanco: con ambos en el mismo claro se
        fundían y el mago acababa pareciendo un fantasma con sombrero. */}
    <circle cx="24" cy="29" r="8.5" fill="oklch(88% 0.06 55)" />
    <circle cx="20.8" cy="27.5" r="1.7" fill={INK} />
    <circle cx="27.2" cy="27.5" r="1.7" fill={INK} />
    <path d="M16.5 31c2 1.6 13 1.6 15 0 .8 5.4-2.4 12-7.5 12s-8.3-6.6-7.5-12Z" fill={LIGHT} />
    <path d="M21 31.5h6c-.6 1.6-5.4 1.6-6 0Z" fill="oklch(80% 0.05 55)" />
  </svg>
)

/**
 * Catálogo por clave estable. La clave es lo que se guarda en
 * `users.avatar_icon` / `groups.icon`, así que NO se renombra: cambiarla
 * dejaría huérfanos los avatares ya elegidos.
 */
export const AVATAR_ICONS: Record<string, AvatarIcon> = {
  astronaut: AvatarAstronaut,
  robot: AvatarRobot,
  cat: AvatarCat,
  ninja: AvatarNinja,
  alien: AvatarAlien,
  ghost: AvatarGhost,
  owl: AvatarOwl,
  fox: AvatarFox,
  dragon: AvatarDragon,
  octopus: AvatarOctopus,
  panda: AvatarPanda,
  wizard: AvatarWizard,
}

/** Orden de presentación en el selector. */
export const AVATAR_ICON_KEYS = Object.keys(AVATAR_ICONS)

export function isValidAvatarIcon(value: unknown): value is string {
  return typeof value === 'string' && value in AVATAR_ICONS
}
