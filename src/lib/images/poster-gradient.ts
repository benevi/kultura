// Matices reutilizados literalmente del canvas F0 v2 para posters sin imagen
// real — nunca gris plano: siempre un gradiente de dos paradas del mismo
// matiz (ver DISENO.md → "Posters / cards sin imagen real").
const POSTER_HUES = [300, 55, 320, 220, 160, 40, 150, 260, 95, 350, 130, 25, 45, 250];

export function posterGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = POSTER_HUES[hash % POSTER_HUES.length];
  return `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`;
}
