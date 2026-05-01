import { useReducer, useCallback } from 'react'
import type { ToastItem, ToastType } from '@/components/ui/Toast'

const MAX_TOASTS = 3

interface ShowPayload {
  message: string
  type?: ToastType
  duration?: number
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

  const show = useCallback(({ message, type = 'info', duration }: ShowPayload) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    dispatch({ type: 'SHOW', payload: { id, message, type, duration } })
  }, [])

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id })
  }, [])

  return { toasts, show, dismiss }
}
