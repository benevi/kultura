'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { HEADER_ICON_CURRENT } from '@/components/layout/nav-shared'

interface HeaderMenuProps {
  /** Nombre accesible del botón (incluye el contador si lo hay). */
  label: string
  /** Contenido visual del botón (icono, avatar…). */
  trigger: ReactNode
  triggerClassName?: string
  /** Marca el botón cuando la página actual es uno de sus destinos. */
  current?: boolean
  panelClassName?: string
  children: (close: () => void) => ReactNode
}

/**
 * Menú desplegable de la cabecera con el patrón *disclosure* de la APG
 * (ACC-10): botón con `aria-expanded`/`aria-controls` y un panel de enlaces
 * normales a continuación en el DOM (sin `role="menu"`, que obligaría a
 * flechas). Esc cierra y devuelve el foco al botón; clic fuera, salir con el
 * foco o cambiar de página también lo cierran.
 *
 * El envoltorio NO es `relative`: el panel se coloca respecto a la barra de la
 * cabecera (que sí lo es), alineado a su borde derecho. Así no se sale de la
 * pantalla a 320 px aunque el botón no sea el último de la fila.
 */
export function HeaderMenu({ label, trigger, triggerClassName, current, panelClassName, children }: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const pathname = usePathname()

  const close = useCallback(() => setOpen(false), [])

  // Al cambiar de página el panel no debe quedarse abierto encima.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    // `pointerdown` y no `mousedown`: en iOS un toque fuera no siempre genera
    // eventos de ratón y el menú se quedaba abierto.
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && rootRef.current && !rootRef.current.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        data-current={current ? 'true' : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(triggerClassName, current && HEADER_ICON_CURRENT)}
      >
        {trigger}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'absolute right-4 md:right-8 top-full mt-2 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-surface-border bg-surface-default p-2 shadow-soft',
          panelClassName
        )}
      >
        {open ? children(close) : null}
      </div>
    </div>
  )
}
