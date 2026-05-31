'use client'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

/**
 * Pestaña reutilizable (Friends, Groups…). Renderiza el botón;
 * el contenedor (`flex gap-1 bg-surface-default rounded-xl border p-1`) lo aporta el padre.
 */
export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        active
          ? 'bg-surface-elevated text-text-primary'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}
