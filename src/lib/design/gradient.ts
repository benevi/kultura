// ============================================================
// KULTURA — Gradientes deterministas F0
// CLAUDE.md §"Posters / cards sin imagen real": dos paradas con el MISMO
// matiz, la segunda más oscura/apagada. El matiz se elige de forma estable a
// partir de una semilla (id), para que un mismo grupo/lista tenga siempre el
// mismo color sin guardarlo en BD.
// ============================================================

/** Matices vivos usados por el canvas F0 v2 para posters y cards. */
export const F0_HUES = [300, 55, 320, 220, 160, 40, 150, 260, 95, 350, 130, 25, 45, 250] as const

export function hueFromSeed(seed: string, hues: readonly number[] = F0_HUES): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hues[hash % hues.length]
}

/** Gradiente de card de grupo/lista (mockup Groups: 46%/0.12 → 24%/0.064). */
export function cardGradient(hue: number): string {
  return `linear-gradient(155deg, oklch(46% 0.12 ${hue}), oklch(24% 0.064 ${hue}))`
}

/**
 * Fondo de hero "feature" (mockup GroupDetail): acento radial arriba-izquierda
 * sobre un gradiente oscuro del mismo matiz.
 */
export function heroGradient(hue: number): string {
  return `radial-gradient(120% 100% at 20% 10%, oklch(55% 0.2 ${hue} / 0.6) 0%, transparent 55%), linear-gradient(160deg, oklch(30% 0.1 ${hue}), oklch(16% 0.06 280))`
}

/** Gradiente de poster sin imagen real (MediaCard/mockups: 50%/0.15 → 28%/0.08). */
export function posterGradient(seed: string): string {
  const hue = hueFromSeed(seed)
  return `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`
}
