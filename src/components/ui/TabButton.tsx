'use client'

import { cn } from '@/lib/utils/index'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

/**
 * Pestaña reutilizable (Amigos, Grupos…) como chip del álbum: la activa va
 * «pegada», en la tinta del texto (blanco de noche, marino en papel) y en 700;
 * la inactiva, en la superficie elevada con hover. El rosa queda para la
 * acción. El contenedor (`flex gap-2`) lo aporta el padre.
 */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // ACC-10: la pestaña activa se anuncia, no solo se pinta.
      aria-pressed={active}
      className={cn(
        'flex-1 min-h-11 px-4 py-2.5 text-sm font-bold rounded-full transition-colors duration-fast ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        active
          ? 'bg-text-primary text-surface-base'
          : 'bg-surface-elevated text-text-secondary hover:bg-surface-border hover:text-text-primary'
      )}
    >
      {children}
    </button>
  )
}
