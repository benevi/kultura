// ============================================================
// KULTURA — Marca para las tarjetas de compartir (next/og)
// El rasterizador de next/og no entiende OKLCH, así que aquí van los hex
// EXACTOS de la tabla de tokens de DISENO.md ("Referencia: tokens OKLCH → hex
// sRGB"); es la única excepción. Antes eran aproximaciones de otra paleta
// (fondo #1a1620 en vez de #0c0d14) y las tarjetas no casaban con la web.
// ============================================================

import { oklchToSrgb, toHex } from "@/lib/design/color";
import { TYPE_HUE, IMMERSIVE_FORMATS } from "@/lib/landing/immersive";
import type { MediaType } from "@/types/media";

export const C = {
  bg: "#0c0d14", // --surface-base
  surface2: "#212330", // --surface-elevated
  text: "#f4f5f8", // --text-primary
  muted: "#aeb0be", // --text-secondary
  pink: "#fb40ad", // --accent-pink
  lime: "#91e300", // --accent-lime
  orange: "#fb7c00", // --accent-orange
  purple: "#9964e5", // --accent-purple
  blue: "#3b9cf6", // --accent-blue
  yellow: "#f1cb1c", // --accent-yellow
  /** Acento radial de las cards "feature" (purple al 35 %). */
  purpleGlow: "rgba(153,100,229,0.35)",
};

/**
 * Color de cada formato en el titular: el mismo `oklch(80% 0.2 H)` con el que
 * se ilumina en el hero (`formatColor`), convertido con la función de la tabla.
 */
export const FORMAT_HEX = Object.fromEntries(
  IMMERSIVE_FORMATS.map((type) => [type, toHex(oklchToSrgb({ l: 0.8, c: 0.2, h: TYPE_HUE[type] }))])
) as Record<MediaType, string>;

/**
 * Las tipografías de la app (Bricolage + Figtree), recortadas a los glifos
 * que se usan. Si Google Fonts no responde, la tarjeta sale con la fuente por
 * defecto en vez de fallar: es mejor una tarjeta sin tipografía que ninguna.
 */
export async function loadFont(family: string, weight: number, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return { name: family.replace(/\+/g, " "), data, weight: weight as 700 | 800, style: "normal" as const };
  } catch {
    return null;
  }
}
