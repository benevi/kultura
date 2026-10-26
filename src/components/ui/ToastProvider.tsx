'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from './Toast'
import type { ToastAction, ToastType } from './Toast'

interface ErrorOptions {
  /** `true`: no se cierra solo, hasta que la persona lo cierre. */
  persistent?: boolean
  /** Milisegundos (mínimo 6000 para errores, lo aplica `Toast`). */
  duration?: number
}

interface ToastContextValue {
  /** `action`: un botón en el aviso (p. ej. «Deshacer» al quitar de la biblioteca). */
  show: (payload: { message: string; type?: ToastType; duration?: number; action?: ToastAction }) => void
  /**
   * Aviso de error accesible: región `assertive`, ≥ 6 s (8 s por defecto),
   * pausa con el ratón o el foco encima y, con `persistent`, sin cierre solo.
   * Para errores de acciones (p. ej. un 502 al guardar en la biblioteca).
   */
  showError: (message: string, options?: ErrorOptions) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastContext must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, show, dismiss } = useToast()

  const showError = useCallback(
    (message: string, options: ErrorOptions = {}) => {
      show({
        message,
        type: 'error',
        duration: options.persistent ? Infinity : options.duration,
      })
    },
    [show]
  )

  const value = useMemo(() => ({ show, showError, dismiss }), [show, showError, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
