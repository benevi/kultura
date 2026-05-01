'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface SingleToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-surface2 text-text border-border',
  error:   'bg-surface2 text-text border-accent',
  info:    'bg-surface2 text-text border-border',
}

const typeIcon: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'i',
}

const iconStyles: Record<ToastType, string> = {
  success: 'text-green-400',
  error:   'text-accent',
  info:    'text-blue-400',
}

function SingleToast({ toast, onDismiss }: SingleToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id)
    }, toast.duration ?? 4000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm w-80 ${typeStyles[toast.type]}`}
    >
      <span className={`font-bold mt-0.5 flex-shrink-0 ${iconStyles[toast.type]}`}>
        {typeIcon[toast.type]}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar"
        className="text-muted hover:text-text transition-colors flex-shrink-0 mt-0.5"
      >
        ×
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map(t => (
        <SingleToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  )
}
