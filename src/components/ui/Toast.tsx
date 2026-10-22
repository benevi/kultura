'use client'

import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { IconClose } from '@/components/icons'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  /**
   * Milisegundos en pantalla. Sin valor: 4 s (aviso) u 8 s (error). Un error
   * nunca dura menos de 6 s (ACC-11). `Infinity` = se queda hasta cerrarlo.
   */
  duration?: number
}

/** Duración por defecto de un aviso normal. */
export const TOAST_DEFAULT_MS = 4000
/** Duración por defecto de un error: tiempo para leerlo con calma. */
export const TOAST_ERROR_DEFAULT_MS = 8000
/** Mínimo para un error aunque se pida menos (WCAG 2.2.1, ACC-11). */
export const TOAST_ERROR_MIN_MS = 6000
/** Desplazamiento horizontal a partir del cual un deslizamiento lo descarta. */
const SWIPE_DISMISS_PX = 80

/** Tiempo efectivo en pantalla (`Infinity` = persistente). */
export function toastDuration(toast: Pick<ToastItem, 'type' | 'duration'>): number {
  if (toast.type === 'error') {
    return Math.max(toast.duration ?? TOAST_ERROR_DEFAULT_MS, TOAST_ERROR_MIN_MS)
  }
  return toast.duration ?? TOAST_DEFAULT_MS
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-surface-border',
  error:   'border-accent-danger',
  info:    'border-surface-border',
}

const typeIcon: Record<ToastType, string> = {
  success: '✓',
  error:   '!',
  info:    'i',
}

const iconStyles: Record<ToastType, string> = {
  success: 'text-accent-positive',
  error:   'text-accent-danger',
  info:    'text-accent-info',
}

const ANIM_DURATION = 150 // matches --duration-base

interface SingleToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

function SingleToast({ toast, onDismiss }: SingleToastProps) {
  const t = useTranslations('notifications')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(toastDuration(toast))
  const startedAtRef = useRef(0)
  const hoverRef = useRef(false)
  const focusRef = useRef(false)
  const dragRef = useRef<{ x: number; id: number } | null>(null)
  const [exiting, setExiting] = useState(false)
  const [dragX, setDragX] = useState(0)

  const startExit = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), ANIM_DURATION)
  }, [toast.id, onDismiss])

  const pause = useCallback(() => {
    if (!timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    remainingRef.current -= Date.now() - startedAtRef.current
  }, [])

  const resume = useCallback(() => {
    if (timerRef.current || exiting || hoverRef.current || focusRef.current) return
    if (!Number.isFinite(remainingRef.current)) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(startExit, Math.max(0, remainingRef.current))
  }, [exiting, startExit])

  useEffect(() => {
    remainingRef.current = toastDuration(toast)
    resume()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Solo al montar o si cambia la duración pedida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration, toast.type])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    if ((e.target as HTMLElement).closest('button')) return
    dragRef.current = { x: e.clientX, id: e.pointerId }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return
    setDragX(e.clientX - dragRef.current.x)
  }
  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.id !== e.pointerId) return
    const dx = e.clientX - dragRef.current.x
    dragRef.current = null
    if (Math.abs(dx) >= SWIPE_DISMISS_PX) startExit()
    else setDragX(0)
  }

  return (
    <div
      data-toast-type={toast.type}
      onMouseEnter={() => { hoverRef.current = true; pause() }}
      onMouseLeave={() => { hoverRef.current = false; resume() }}
      onFocus={() => { focusRef.current = true; pause() }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        focusRef.current = false
        resume()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={dragX ? { transform: `translateX(${dragX}px)`, opacity: Math.max(0.3, 1 - Math.abs(dragX) / 240) } : undefined}
      className={`pointer-events-auto touch-pan-y flex items-center gap-3 pl-4 pr-1 py-1 min-h-14 rounded-18 border bg-surface-elevated text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.15)] text-sm w-full ${typeStyles[toast.type]} ${exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <span aria-hidden className={`font-bold flex-shrink-0 ${iconStyles[toast.type]}`}>
        {typeIcon[toast.type]}
      </span>
      <p className="flex-1 leading-snug py-2">{toast.message}</p>
      <button
        type="button"
        onClick={startExit}
        aria-label={t('dismiss')}
        className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-default transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring"
      >
        <IconClose className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

/**
 * Avisos flotantes. Dos regiones vivas que existen desde el principio (un
 * lector de pantalla no anuncia una región que nace ya con el texto dentro):
 * `role="status"` (educada) para avisos y `aria-live="assertive"` solo para
 * errores (ACC-11). En móvil van centrados por encima de la `BottomNav` y de
 * la zona segura (MOV-6, V9); en escritorio, abajo a la derecha.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const errors = toasts.filter((x) => x.type === 'error')
  const others = toasts.filter((x) => x.type !== 'error')

  return createPortal(
    <div
      data-testid="toast-viewport"
      className="pointer-events-none fixed z-50 inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-4 md:bottom-4 flex flex-col items-center md:items-end gap-2"
    >
      <div aria-live="assertive" aria-relevant="additions text" className="flex flex-col gap-2 w-full max-w-sm md:w-80">
        {errors.map((x) => (
          <SingleToast key={x.id} toast={x} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-2 w-full max-w-sm md:w-80">
        {others.map((x) => (
          <SingleToast key={x.id} toast={x} onDismiss={onDismiss} />
        ))}
      </div>
    </div>,
    document.body
  )
}
