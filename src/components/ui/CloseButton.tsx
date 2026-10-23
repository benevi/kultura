'use client'

import { forwardRef } from 'react'
import { IconClose } from '@/components/icons'
import { cn } from '@/lib/utils/index'

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Nombre accesible traducido ("Cerrar", "Limpiar progreso"…). Obligatorio. */
  label: string
  /** `md` (44 px, por defecto) o `sm` (36 px visibles con zona táctil de 44). */
  size?: 'sm' | 'md'
}

/**
 * Botón "×" único de la app (ACC-12): 44×44 px de zona táctil, aspa de 16 px,
 * anillo de foco del sistema y nombre accesible obligatorio. Sustituye a los
 * "×" de texto sin relleno (~12×20 px) de los modales y del progreso.
 */
export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ label, size = 'md', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center justify-center rounded-full',
        'text-text-secondary hover:text-text-primary hover:bg-surface-default transition-colors',
        'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-11 w-11' : 'h-9 w-9 after:absolute after:-inset-1 after:content-[""]',
        className
      )}
      {...props}
    >
      <IconClose className="h-4 w-4" />
    </button>
  )
)
CloseButton.displayName = 'CloseButton'
