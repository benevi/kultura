'use client'

import { createContext, useContext } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from './Toast'
import type { ToastType } from './Toast'

interface ToastContextValue {
  show: (payload: { message: string; type?: ToastType; duration?: number }) => void
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

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
