'use client'

// ============================================================
// KULTURA — Pegado escalonado de una rejilla pública (DISENO.md, Movimiento)
//
// Envuelve la lista de cromos de una página pública: la PRIMERA vez que
// entra en pantalla, sus cromos se pegan uno detrás de otro (40 ms por
// cromo, ≤ 600 ms en total; GSAP se carga en ese momento). Una vez por
// rejilla y página; nada con movimiento reducido. Sin textos: no necesita
// ningún namespace en el navegador.
// ============================================================

import { useRef } from 'react'
import { usePasteGrid } from '@/lib/motion/usePasteGrid'

type Tag = 'ul' | 'ol' | 'div'

export function PasteOnEnter({
  as: Comp = 'ul',
  className,
  children,
  'aria-label': ariaLabel,
}: {
  as?: Tag
  className?: string
  children: React.ReactNode
  'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  usePasteGrid(ref, { trigger: 'enter' })
  return (
    <Comp ref={ref as React.Ref<never>} className={className} aria-label={ariaLabel} data-paste-grid="">
      {children}
    </Comp>
  )
}
