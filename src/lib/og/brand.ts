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
  bg: "#061637", // --surface-base
  surface2: "#152c5c", // --surface-elevated
  text: "#f6f8fd", // --text-primary
  muted: "#c5d2e9", // --text-secondary
  pink: "#ff2d8a", // --accent-pink
  lime: "#ffe600", // --accent-lime
  orange: "#ffb347", // --accent-orange
  purple: "#00a0e3", // --accent-purple
  blue: "#5aa9ff", // --accent-blue
  yellow: "#ffe600", // --accent-yellow
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

/** Una semana en la caché de datos: la fuente recortada para un texto no cambia. */
const FONT_CACHE = { next: { revalidate: 7 * 86400 } } as const;

/**
 * Las tipografías de la app (Bricolage + Figtree), recortadas a los glifos
 * que se usan. Si Google Fonts no responde, la tarjeta sale con la fuente por
 * defecto en vez de fallar: es mejor una tarjeta sin tipografía que ninguna.
 */
export async function loadFont(family: string, weight: number, text: string) {
  try {
    // Next 15 no cachea `fetch` por defecto (en 14 sí): la hoja y el recorte
    // de la fuente no cambian para un mismo texto, se guardan en la caché de
    // datos en vez de pedirlos a Google Fonts en cada tarjeta.
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`,
      FONT_CACHE,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    const data = await fetch(url, FONT_CACHE).then((r) => r.arrayBuffer());
    return { name: family.replace(/\+/g, " "), data, weight: weight as 700 | 800, style: "normal" as const };
  } catch {
    return null;
  }
}

type LoadedFont = NonNullable<Awaited<ReturnType<typeof loadFont>>>;

/**
 * Opción `fonts` de `ImageResponse`. Con una lista VACÍA (Google Fonts no
 * respondió) satori no usa su fuente por defecto y la tarjeta falla con "No
 * fonts are loaded": sin fuentes cargadas se omite la opción para que salga
 * con la fuente por defecto.
 */
export function fontsOption(fonts: LoadedFont[]): { fonts?: LoadedFont[] } {
  return fonts.length > 0 ? { fonts } : {};
}
