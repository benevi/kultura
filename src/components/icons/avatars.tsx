// ============================================================
// KULTURA — Iconos de personaje para avatares (E-AVATAR-ICONS)
//
// Set propio, en la línea del resto de `components/icons`: formas geométricas
// llenas, sin trazos finos, para que se lean a 32px dentro del círculo del
// avatar. Van en `currentColor` a propósito — el color lo sigue poniendo
// `avatar_color`, así que el personaje se pinta sobre el degradado que el
// usuario ya eligió y no hace falta una paleta nueva (CLAUDE.md).
//
// Los mismos iconos sirven para los grupos: un grupo es otra "identidad" que
// necesita una cara, y duplicar el set solo daría dos catálogos que mantener.
// ============================================================

import type { SVGProps } from 'react'

export type AvatarIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element

const base = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  xmlns: 'http://www.w3.org/2000/svg',
} as const

export const AvatarAstronaut: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2a7 7 0 0 0-7 7v1.5A1.5 1.5 0 0 0 6.5 12H7a5 5 0 0 0 10 0h.5a1.5 1.5 0 0 0 1.5-1.5V9a7 7 0 0 0-7-7Zm-3.5 7A3.5 3.5 0 0 1 12 5.5 3.5 3.5 0 0 1 15.5 9v.5h-7V9Z" />
    <path d="M7.2 15.1A6 6 0 0 0 4 20.4V22h16v-1.6a6 6 0 0 0-3.2-5.3 6.9 6.9 0 0 1-9.6 0Z" />
  </svg>
)

export const AvatarRobot: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M11 2h2v2.2a6 6 0 0 1 .9.1H16a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-6a5 5 0 0 1 5-5h2.1c.3-.05.6-.08.9-.1V2Zm-2 8a1.6 1.6 0 0 0 0 3.2A1.6 1.6 0 0 0 9 10Zm6 0a1.6 1.6 0 0 0 0 3.2A1.6 1.6 0 0 0 15 10Zm-6 6h6v1.8H9V16Z" />
    <path d="M1 11h1.4v4H1a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Zm21.6 0H24a0 0 0 0 1 0 0v6a0 0 0 0 1 0 0h-1.4v-6Z" />
  </svg>
)

export const AvatarCat: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 3.2 7.6 6A8.9 8.9 0 0 1 12 5c1.6 0 3.1.35 4.4 1L20 3.2V9a8 8 0 0 1-16 0V3.2ZM9 11a1.4 1.4 0 0 0 0 2.8A1.4 1.4 0 0 0 9 11Zm6 0a1.4 1.4 0 0 0 0 2.8A1.4 1.4 0 0 0 15 11Zm-3 3.6-1.4 1.2h2.8L12 14.6Z" />
    <path d="M12 17.4c-1.6 0-2.9-.6-3.7-1.6a7.9 7.9 0 0 0 7.4 0c-.8 1-2.1 1.6-3.7 1.6Z" />
  </svg>
)

export const AvatarNinja: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 18 0 9 9 0 0 0-9-9Zm-7 9c0-.7.1-1.4.3-2h13.4c.2.6.3 1.3.3 2 0 .5-.05 1-.15 1.5H5.15A7.2 7.2 0 0 1 5 12Z" />
    <path d="M8.2 11.1a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3Zm7.6 0a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3Z" opacity=".45" />
  </svg>
)

export const AvatarAlien: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2c4.4 0 8 3.1 8 7.6 0 5.6-4.3 10.4-8 12.4C8.3 20 4 15.2 4 9.6 4 5.1 7.6 2 12 2ZM8.6 8.4c-1 0-1.7.8-1.7 1.9 0 1.5 1.2 3 2.6 3 1 0 1.6-.8 1.6-1.8 0-1.6-1.1-3.1-2.5-3.1Zm6.8 0c-1.4 0-2.5 1.5-2.5 3.1 0 1 .6 1.8 1.6 1.8 1.4 0 2.6-1.5 2.6-3 0-1.1-.7-1.9-1.7-1.9Z" />
  </svg>
)

export const AvatarGhost: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2a8 8 0 0 0-8 8v12l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2 2.7 2V10a8 8 0 0 0-8-8ZM9.3 8.5a1.6 1.6 0 0 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm5.4 0a1.6 1.6 0 0 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
  </svg>
)

export const AvatarOwl: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2 8.6 4.6A8 8 0 0 0 4 11.8v3.4A6.8 6.8 0 0 0 12 22a6.8 6.8 0 0 0 8-6.8v-3.4a8 8 0 0 0-4.6-7.2L12 2ZM8.8 8.2a3 3 0 0 1 3 3 3 3 0 0 1-6 0 3 3 0 0 1 3-3Zm6.4 0a3 3 0 0 1 3 3 3 3 0 0 1-6 0 3 3 0 0 1 3-3ZM12 13.4l1.5 2h-3l1.5-2Z" />
    <circle cx="8.8" cy="11.2" r="1.2" opacity=".45" />
    <circle cx="15.2" cy="11.2" r="1.2" opacity=".45" />
  </svg>
)

export const AvatarFox: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 3.5 6.8 7A9 9 0 0 1 12 5.4c1.9 0 3.7.6 5.2 1.6L21 3.5l-.7 6.2A8.3 8.3 0 0 1 12 21a8.3 8.3 0 0 1-8.3-11.3L3 3.5Zm6.2 8a1.4 1.4 0 0 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm5.6 0a1.4 1.4 0 0 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM12 16l-1.6 1.4h3.2L12 16Z" />
  </svg>
)

export const AvatarDragon: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 2.8 8.2 6A8.4 8.4 0 0 1 12 5.1c1.4 0 2.7.3 3.8.9L19 2.8l-.5 4.6A8.2 8.2 0 0 1 20 12c0 4.6-3.6 8.4-8 8.4S4 16.6 4 12c0-1.7.5-3.3 1.5-4.6L5 2.8Zm4.2 8.4a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3Zm5.6 0a1.5 1.5 0 0 0 0 3 1.5 1.5 0 0 0 0-3ZM8.6 16.2h6.8c-.7 1.2-2 2-3.4 2s-2.7-.8-3.4-2Z" />
  </svg>
)

export const AvatarOctopus: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2a7 7 0 0 0-7 7v3.6h14V9a7 7 0 0 0-7-7ZM9.3 8.2a1.6 1.6 0 0 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm5.4 0a1.6 1.6 0 0 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
    <path d="M5 14.2h2.2v3.4a1.1 1.1 0 0 1-2.2 0v-3.4Zm3.6 0h2.2v4.6a1.1 1.1 0 0 1-2.2 0v-4.6Zm4.6 0h2.2v4.6a1.1 1.1 0 0 1-2.2 0v-4.6Zm3.6 0H19v3.4a1.1 1.1 0 0 1-2.2 0v-3.4Z" />
  </svg>
)

export const AvatarPanda: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6.4 3a3.2 3.2 0 0 1 2.9 1.8A8.7 8.7 0 0 1 12 4.4c.95 0 1.85.15 2.7.4A3.2 3.2 0 1 1 18.8 9c.5 1 .8 2.1.8 3.3 0 4.3-3.4 7.7-7.6 7.7S4.4 16.6 4.4 12.3c0-1.2.3-2.3.8-3.3A3.2 3.2 0 0 1 6.4 3Zm2.7 8a2 2 0 0 0 0 4 2 2 0 0 0 0-4Zm5.8 0a2 2 0 0 0 0 4 2 2 0 0 0 0-4ZM12 15.6l-1.4 1.3h2.8L12 15.6Z" />
  </svg>
)

export const AvatarWizard: AvatarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 1.4 18.4 9H5.6L12 1.4ZM4.4 10.4h15.2v1.8H4.4v-1.8Z" />
    <path d="M6.6 13.6h10.8V16a5.4 5.4 0 0 1-10.8 0v-2.4Zm2.8 1.1a1.3 1.3 0 0 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm5.2 0a1.3 1.3 0 0 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
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
