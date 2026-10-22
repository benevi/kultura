// ============================================================
// KULTURA — Piezas comunes de la navegación con sesión.
// Sin 'use client' a propósito: la cabecera (Server Component) y los
// componentes cliente (NavLinks, BottomNav, menús) usan las mismas clases y
// la misma lista de destinos. Lo que exporta un módulo 'use client' llega al
// servidor como referencia de cliente, no como string ni como función.
// ============================================================

import type { SVGProps } from 'react'
import { IconHome, IconCompass, IconLibrary, IconLists, type KIcon } from '@/components/icons'

/** Perfil: busto relleno, misma geometría chunky que el resto de `@/components/icons`. */
export const IconProfile: KIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <circle cx="12" cy="8" r="4.5" />
    <path d="M3.5 20.2c0-4 3.8-6.7 8.5-6.7s8.5 2.7 8.5 6.7c0 .7-.6 1.3-1.3 1.3H4.8c-.7 0-1.3-.6-1.3-1.3Z" />
  </svg>
)

export interface PrimaryNavItem {
  key: 'home' | 'discover' | 'library' | 'lists' | 'profile'
  /** Texto corto: el mismo en la barra inferior y en la cabecera (DIS-9). */
  labelKey: 'home' | 'discover' | 'libraryTab' | 'lists' | 'profileTab'
  href: string
  icon: KIcon
}

/**
 * Los 5 destinos de la app con sesión, en el mismo orden en móvil y en
 * escritorio (DIS-9). Mensajes, amigos y grupos viven en el centro «Social» de
 * la cabecera (`SocialMenu`); Ajustes, Sugerencias e idioma, en el menú del
 * avatar. Una sola lista para que `NavLinks` y `BottomNav` no se separen.
 */
export function primaryNavItems(username: string): PrimaryNavItem[] {
  return [
    { key: 'home', labelKey: 'home', href: '/home', icon: IconHome },
    { key: 'discover', labelKey: 'discover', href: '/discover', icon: IconCompass },
    { key: 'library', labelKey: 'libraryTab', href: '/library', icon: IconLibrary },
    { key: 'lists', labelKey: 'lists', href: '/lists', icon: IconLists },
    { key: 'profile', labelKey: 'profileTab', href: `/profile/${encodeURIComponent(username)}`, icon: IconProfile },
  ]
}

/**
 * ¿Está `pathname` dentro de la sección `href`? Por prefijo de segmento, no por
 * igualdad (MOV-7): `/lists/abc` es Listas, `/chat/123` es Mensajes; pero
 * `/listsx` no es `/lists`.
 */
export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  const base = href.replace(/\/+$/, '') || '/'
  return path === base || path.startsWith(`${base}/`)
}

/** Foco visible común (DISENO.md: contorno de 2 px `--focus-ring`, no sombra). */
export const FOCUS_RING =
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

/** Caja de icono de la cabecera: 44×44, radio 16, fondo `--surface-2` (DISENO.md). */
export const HEADER_ICON_BOX = [
  'relative flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-2xl bg-surface-elevated text-text-secondary',
  'hover:text-text-primary transition-colors',
  FOCUS_RING,
].join(' ')

/** Estado «estás aquí» de una caja de la cabecera. */
export const HEADER_ICON_CURRENT = 'text-text-primary ring-2 ring-inset ring-surface-border'

/** Fila de enlace de un panel de la cabecera: 48 px de alto, ancho completo. */
export const MENU_ROW = [
  'flex items-center gap-3 w-full min-h-12 px-3 rounded-[14px] text-sm font-semibold text-text-primary text-left',
  'hover:bg-surface-elevated transition-colors',
  FOCUS_RING,
  'focus-visible:outline-offset-[-2px]',
].join(' ')

/** Contador de la cabecera. Decorativo: el número va en el nombre del botón. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-pink text-on-accent-pink text-[11px] font-bold leading-none flex items-center justify-center ring-2 ring-surface-default"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
