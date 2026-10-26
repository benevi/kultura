import { useReducer, useCallback, useRef, useEffect } from 'react'
import type { ToastAction, ToastItem, ToastType } from '@/components/ui/Toast'

const MAX_TOASTS = 3

interface ShowPayload {
  message: string
  type?: ToastType
  duration?: number
  action?: ToastAction
}

type Action =
  | { type: 'SHOW'; payload: ToastItem }
  | { type: 'DISMISS'; id: string }

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case 'SHOW': {
      const next = [...state, action.payload]
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    }
    case 'DISMISS':
      return state.filter(t => t.id !== action.id)
    default:
      return state
  }
}

export function useToast() {
  const [toasts, dispatch] = useReducer(reducer, [])
  const toastsRef = useRef(toasts)
  useEffect(() => {
    toastsRef.current = toasts
  }, [toasts])

  const show = useCallback(({ message, type = 'info', duration, action }: ShowPayload) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    // Un aviso que sale desplazado por los nuevos también "caduca".
    const overflow = toastsRef.current.length + 1 - MAX_TOASTS
    if (overflow > 0) {
      for (const old of toastsRef.current.slice(0, overflow)) old.action?.onExpire?.()
      toastsRef.current = toastsRef.current.slice(overflow)
    }
    dispatch({ type: 'SHOW', payload: { id, message, type, duration, ...(action ? { action } : {}) } })
  }, [])

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id })
  }, [])

  return { toasts, show, dismiss }
}
