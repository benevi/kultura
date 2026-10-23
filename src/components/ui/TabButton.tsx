'use client'

import { F0 } from '@/lib/design/f0-tokens'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

/**
 * Pestaña reutilizable (Friends, Groups…), como chip F0 (DISENO.md — Chips):
 * activo = fondo de color vivo + texto on-color, font-weight 800; inactivo =
 * fondo --surface-2 + texto --text, font-weight 700. El contenedor (`flex
 * gap-2`) lo aporta el padre.
 */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // ACC-10: la pestaña activa se anuncia, no solo se pinta.
      aria-pressed={active}
      className={`flex-1 min-h-11 px-4 py-2.5 text-sm rounded-full transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
        active ? 'font-extrabold' : 'font-bold'
      }`}
      style={
        active
          ? { background: F0.pink, color: F0.onPink }
          : { background: F0.surface2, color: F0.text }
      }
    >
      {children}
    </button>
  )
}
