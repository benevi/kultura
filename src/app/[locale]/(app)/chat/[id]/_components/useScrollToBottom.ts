import { useCallback, useRef } from 'react'

/**
 * Marca del final de la conversación y desplazamiento hasta ella.
 * ACC-19: el desplazamiento suave respeta `prefers-reduced-motion` (la regla
 * global de CSS no alcanza a `scrollIntoView` desde JS).
 */
export function useScrollToBottom() {
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  return { bottomRef, scrollToBottom }
}
