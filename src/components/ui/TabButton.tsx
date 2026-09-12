'use client'

import { F0 } from '@/lib/design/f0-tokens'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

/**
 * Pestaña reutilizable (Friends, Groups…), como chip F0 (CLAUDE.md — Chips):
 * activo = fondo de color vivo + texto on-color, font-weight 800; inactivo =
 * fondo --surface-2 + texto --text, font-weight 700. El contenedor (`flex
 * gap-2`) lo aporta el padre.
 */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-sm rounded-full transition-colors ${
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
