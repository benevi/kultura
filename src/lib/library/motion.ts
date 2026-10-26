// ============================================================
// KULTURA — Microinteracciones de la biblioteca (F-24, DIS-14)
//
// Sello de «Visto» y estrellas en cascada. Todo ≤ 300 ms, solo `transform` y
// `opacity` (no mueven la maquetación: CLS 0) y nada si la persona pidió
// menos movimiento. Se hace con la Web Animations API para no depender de
// keyframes globales ni de estilos en línea bloqueables.
// ============================================================

/** Duraciones de DISENO.md (--duration-fast / --duration-slow) y el paso de la cascada. */
export const STAMP_MS = 250
export const STAR_POP_MS = 140
export const STAR_CASCADE_STEP_MS = 40
/** --ease-standard */
export const EASE_STANDARD = 'cubic-bezier(0, 0, 0.2, 1)'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canAnimate(el: Element | null | undefined): el is Element & { animate: Element['animate'] } {
  return !!el && typeof (el as Element).animate === 'function' && !prefersReducedMotion()
}

/**
 * Pegatina lima rotada −8° que «cae» de escala 1,2 a 1 (DIS-14). Devuelve
 * false si no se anima (movimiento reducido o navegador sin WAAPI).
 */
export function playStamp(el: Element | null | undefined): boolean {
  if (!canAnimate(el)) return false
  el.animate(
    [
      { transform: 'rotate(-8deg) scale(1.2)', opacity: 0 },
      { transform: 'rotate(-8deg) scale(1)', opacity: 1 },
    ],
    { duration: STAMP_MS, easing: EASE_STANDARD, fill: 'both' }
  )
  return true
}

/**
 * Estrellas que se rellenan en cascada: cada una «salta» 40 ms después de la
 * anterior. Con 5 estrellas: 4 × 40 + 140 = 300 ms en total.
 */
export function playStarCascade(stars: Array<Element | null>): boolean {
  if (!stars.some((s) => canAnimate(s))) return false
  stars.forEach((star, i) => {
    if (!canAnimate(star)) return
    star.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: STAR_POP_MS, delay: i * STAR_CASCADE_STEP_MS, easing: EASE_STANDARD }
    )
  })
  return true
}
