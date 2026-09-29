'use client'


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
      onClick={onClick}
      type="button"
      aria-pressed={active}
      className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 text-[13px] rounded-full transition-colors ${
        active
          ? 'font-extrabold bg-accent-pink text-on-accent-pink'
          : 'font-bold bg-surface-elevated text-text-primary hover:brightness-110'
      }`}
    >
      {children}
    </button>
  )
}
