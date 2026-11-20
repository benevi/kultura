// Matices reutilizados literalmente del canvas F0 v2 para posters sin imagen
// real — nunca gris plano: siempre un gradiente de dos paradas del mismo
// matiz (posters y cards sin imagen real).
const POSTER_HUES = [300, 55, 320, 220, 160, 40, 150, 260, 95, 350, 130, 25, 45, 250];

export function posterGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = POSTER_HUES[hash % POSTER_HUES.length];
  return `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`;
}

// Fórmula de la ficha (MediaDetail): degradado lineal de dos paradas del mismo
// matiz + acento radial en la esquina superior izquierda, con su propia paleta
// de 6 matices. Es OTRA fórmula que `posterGradient`: la misma obra sin
// portada sale de otro color en la ficha y en su tarjeta. Unificarlas cambia lo
// que se ve y se decide aparte (C14).
const FEATURE_HUES = [350, 130, 55, 300, 250, 95] as const;

export function posterGradientFeature(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = FEATURE_HUES[hash % FEATURE_HUES.length];
  return [
    `radial-gradient(120% 90% at 20% 15%, oklch(50% 0.16 ${hue} / 0.55) 0%, transparent 55%)`,
    `linear-gradient(160deg, oklch(38% 0.13 ${hue}), oklch(18% 0.06 ${hue}))`,
  ].join(", ");
}
