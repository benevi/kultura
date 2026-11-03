'use client'

// ============================================================
// KULTURA — Pegado de una fila de cromos en la app (DISENO.md, Movimiento)
// Una vez por fila y página, al montar (dentro de la app nada va ligado al
// scroll). GSAP se carga en ese momento; nada con movimiento reducido.
// ============================================================

import { useRef } from 'react'
import { usePasteGrid } from '@/lib/motion/usePasteGrid'

export function PasteOnMount({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  usePasteGrid(ref, { trigger: 'mount' })
  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  )
}
