'use client'

// ============================================================
// KULTURA — Modal (ACC-1 + MOV-8)
//
// Único diálogo de la app, sobre @radix-ui/react-dialog (ya usamos Radix
// Popover). Lo que da Radix y aquí se configura:
// - `role="dialog"` (o `alertdialog`) con `aria-labelledby` al título y,
//   si hay descripción, `aria-describedby`; `aria-modal="true"`.
// - Foco dentro al abrir (el primer control, o `initialFocusRef`), trampa de
//   foco (Tab y Mayús+Tab no salen) y el resto de la página `aria-hidden`.
// - Esc cierra; el scroll del fondo queda bloqueado.
// - Al cerrar, el foco vuelve al control que lo abrió (o a `finalFocusRef`
//   si ese control ya no existe, p. ej. "Añadir" pasa a ser "Actualizar").
//
// Variante `sheet`: en móvil (< md) es una hoja inferior a todo el ancho,
// con `max-h-[85dvh]`, scroll interno, margen de la zona segura y un asa que
// se arrastra hacia abajo para cerrar; desde `md` es el diálogo centrado.
//
// Se conservan `data-testid="modal-overlay"` (fondo) y `"modal-panel"`
// (contenido): clic en el fondo cierra, clic en el panel no.
// ============================================================

import { useRef, useState, type ReactNode, type RefObject } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { cn } from '@/lib/utils/index'

/** Arrastre (px) a partir del cual la hoja se cierra al soltar el asa. */
export const SHEET_DISMISS_PX = 80

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Texto que el lector lee al abrir, después del título. */
  description?: ReactNode
  children?: ReactNode
  /** `dialog` (centrado siempre) o `sheet` (hoja inferior en móvil). */
  variant?: 'dialog' | 'sheet'
  /** `alertdialog` para confirmaciones destructivas. */
  role?: 'dialog' | 'alertdialog'
  /** Nombre del botón ×. Sin él, `common.close`. */
  closeLabel?: string
  /** `false` oculta el × (el diálogo tiene su propio "Cancelar" visible). */
  showClose?: boolean
  /** Mientras es `false` (p. ej. guardando), ni Esc ni el fondo cierran. */
  dismissible?: boolean
  /**
   * Control que recibe el foco al abrir. Sin él, el que lleve
   * `data-autofocus` y, si no hay, el primero del diálogo.
   */
  initialFocusRef?: RefObject<HTMLElement>
  /** Dónde va el foco al cerrar si el disparador ya no está en la página. */
  finalFocusRef?: RefObject<HTMLElement>
  /** Clases extra del panel (ancho, separación…). */
  className?: string
  /** Visualmente oculto (sigue nombrando al diálogo). */
  hideTitle?: boolean
  /**
   * Error de la acción del diálogo (p. ej. un 502 al guardar). Se pinta y se
   * anuncia DENTRO del diálogo (`role="alert"`): con el diálogo abierto, el
   * resto de la página —los toasts incluidos— queda `aria-hidden` y debajo.
   */
  error?: string | null
}

function TranslatedClose(props: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations('common')
  return <CloseButton label={t('close')} className="-mr-2 -mt-2" {...props} />
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  variant = 'dialog',
  role = 'dialog',
  closeLabel,
  showClose = true,
  dismissible = true,
  initialFocusRef,
  finalFocusRef,
  className,
  hideTitle = false,
  error = null,
}: ModalProps) {
  // Elemento con el foco justo antes de abrir: Radix solo lo devuelve si hay
  // `Dialog.Trigger`, y aquí cada pantalla tiene su propio botón.
  const openerRef = useRef<HTMLElement | null>(null)
  const overlayDownRef = useRef<EventTarget | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ y: number; id: number } | null>(null)
  const [dragY, setDragY] = useState(0)

  const isSheet = variant === 'sheet'

  function requestClose() {
    if (dismissible) onClose()
  }

  function onHandleDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { y: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return
    setDragY(Math.max(0, e.clientY - dragRef.current.y))
  }
  function onHandleEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return
    const dy = e.clientY - dragRef.current.y
    dragRef.current = null
    setDragY(0)
    if (dy >= SHEET_DISMISS_PX) requestClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <Dialog.Portal>
        {/* El panel va DENTRO del fondo (patrón "scrollable overlay" de Radix):
            así centra sin `transform` (que la animación pisaría) y el fondo
            puede desplazarse si el panel no cabe. */}
        <Dialog.Overlay
          data-testid="modal-overlay"
          onPointerDown={(e) => { overlayDownRef.current = e.target }}
          onClick={(e) => {
            const startedOnOverlay =
              overlayDownRef.current === null || overlayDownRef.current === e.currentTarget
            overlayDownRef.current = null
            // Solo el clic que empieza y acaba en el fondo cierra: arrastrar
            // una selección de texto desde el panel no debe cerrarlo.
            if (e.target === e.currentTarget && startedOnOverlay) requestClose()
          }}
          className={cn(
            'fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/60 animate-backdrop-in',
            isSheet ? 'items-end md:items-center md:p-4' : 'items-center p-4'
          )}
        >
          <Dialog.Content
            data-testid="modal-panel"
            role={role}
            aria-modal="true"
            {...(description ? {} : { 'aria-describedby': undefined })}
            ref={contentRef}
            onOpenAutoFocus={(e) => {
              openerRef.current = document.activeElement as HTMLElement | null
              const target =
                initialFocusRef?.current ??
                contentRef.current?.querySelector<HTMLElement>('[data-autofocus]')
              if (target) {
                e.preventDefault()
                target.focus()
              }
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              const opener = openerRef.current
              const target = opener && opener.isConnected ? opener : finalFocusRef?.current
              target?.focus()
            }}
            // El fondo cierra con su propio onClick (ver arriba); Radix no.
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => { if (!dismissible) e.preventDefault() }}
            style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
            className={cn(
              'relative flex w-full max-w-sm flex-col gap-4 border border-surface-border bg-surface-elevated text-text-primary outline-none',
              isSheet
                ? [
                    'max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-bento-lg px-5 pt-3',
                    'pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-toast-in max-w-none',
                    'md:max-w-sm md:max-h-[calc(100dvh-2rem)] md:rounded-bento-lg md:p-6 md:animate-modal-in',
                  ]
                : 'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-bento-lg p-6 animate-modal-in',
              className
            )}
          >
            {isSheet && (
              <div
                aria-hidden="true"
                data-testid="sheet-handle"
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleEnd}
                onPointerCancel={onHandleEnd}
                className="-mx-5 -mb-2 flex h-6 cursor-grab touch-none items-center justify-center md:hidden"
              >
                <span className="h-1.5 w-10 rounded-full bg-surface-border" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title
                className={cn(
                  'font-display text-xl font-extrabold leading-tight text-text-primary',
                  hideTitle && 'sr-only'
                )}
              >
                {title}
              </Dialog.Title>
              {showClose &&
                (closeLabel ? (
                  <CloseButton
                    label={closeLabel}
                    onClick={requestClose}
                    disabled={!dismissible}
                    className="-mr-2 -mt-2"
                  />
                ) : (
                  <TranslatedClose onClick={requestClose} disabled={!dismissible} />
                ))}
            </div>
            {description && (
              <Dialog.Description className="text-sm text-text-secondary">{description}</Dialog.Description>
            )}
            {children}
            {/* Región que existe desde que abre el diálogo: un lector no
                anuncia la que nace ya con texto. */}
            <p role="alert" data-testid="modal-error" className={error ? 'text-sm text-accent-danger' : 'sr-only'}>
              {error ?? ''}
            </p>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
