'use client'

import { useEffect, useRef } from 'react'

/**
 * Llama a `onEscape` cuando se pulsa Escape mientras `active` sea true.
 * Para modales: cerrar con teclado es requisito de accesibilidad (WCAG 2.1.2).
 * Guarda el callback en una ref para no re-suscribirse en cada render.
 */
export function useEscapeKey(onEscape: () => void, active = true): void {
  const handlerRef = useRef(onEscape)
  handlerRef.current = onEscape

  useEffect(() => {
    if (!active) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handlerRef.current()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [active])
}
