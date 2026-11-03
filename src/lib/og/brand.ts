// ============================================================
// KULTURA — Marca para las tarjetas de compartir (next/og)
// El rasterizador de next/og no entiende OKLCH, así que aquí van los hex
// EXACTOS de la tabla de tokens de DISENO.md ("Referencia: tokens OKLCH → hex
// sRGB"); es la única excepción.
//
// «Álbum de cromos»: las tarjetas son páginas impresas del álbum (campo cian
// o amarillo, tinta marina, página blanca, el rosa solo para la marca) con el
// titular en Lilita One (`loadDisplayFont`) y el logotipo `kultura.` en
// Bricolage 700 (`loadLogoFont`, la marca no cambia). La API de antes (`C`,
// `FORMAT_HEX`, `loadFont`, `fontsOption`) se conserva: la usan las tarjetas
// de otras páginas.
// ============================================================

import type { MediaType } from "@/types/media";

export const C = {
  bg: "#061637", // --surface-base (noche)
  surface2: "#152c5c", // --surface-elevated (noche)
  text: "#f6f8fd", // --text-primary (noche)
  muted: "#c5d2e9", // --text-secondary (noche)
  pink: "#ff2d8a", // --accent-pink = --album-pink
  lime: "#ffe600", // --accent-lime (= amarillo del álbum)
  orange: "#ffb347", // --accent-orange (= libro)
  purple: "#00a0e3", // --accent-purple (= cian del álbum: no hay violeta)
  blue: "#5aa9ff", // --accent-blue (= serie)
  yellow: "#ffe600", // --accent-yellow
  /** Tintas de imprenta del álbum (DISENO.md). */
  cyan: "#00a0e3", // --album-cyan
  navy: "#0b2a6b", // --album-navy (tinta del texto en papel)
  white: "#ffffff", // --album-white (página, borde del cromo)
  ink: "#04102c", // --album-ink (texto sobre rosa, amarillo y cian)
  /** Texto secundario sobre el papel blanco (`.theme-paper`). */
  paperMuted: "#29457d",
  /**
   * Antes era un halo violeta; el sistema no tiene violeta ni halos. Se
   * conserva la clave (la usan otras tarjetas) con el cian al 35 %.
   */
  purpleGlow: "rgba(0,160,227,0.35)",
};

/**
 * Color de cada formato: los `--format-*` de DISENO.md en hex exacto. Son
 * datos (el punto junto al nombre del formato), nunca adorno.
 */
export const FORMAT_HEX: Record<MediaType, string> = {
  movie: "#ff4f9a",
  tv: "#5aa9ff",
  anime: "#c6f24e",
  manga: "#ff6b5a",
  game: "#3fd9e6",
  book: "#ffb347",
  comic: "#ffe04a",
};

/** Familias tal como las nombran las tarjetas en `fontFamily`. */
export const OG_FONT = {
  display: "Lilita One",
  body: "Figtree",
  logo: "Bricolage Grotesque",
} as const;

/** Medidas del cromo a escala de tarjeta (3 px y 4 px en la web, × 2,5). */
export const OG_CROMO = { border: 8, radius: 10 } as const;

/** Una semana en la caché de datos: la fuente recortada para un texto no cambia. */
const FONT_CACHE = { next: { revalidate: 7 * 86400 } } as const;

type FontWeight = 400 | 500 | 600 | 700 | 800;

/**
 * Una tipografía de Google Fonts recortada a los glifos que se usan (satori
 * no lee woff2, así que no sirven los archivos autoalojados de la web). Si
 * Google Fonts no responde, la tarjeta sale con la fuente por defecto en vez
 * de fallar: es mejor una tarjeta sin tipografía que ninguna.
 */
export async function loadFont(family: string, weight: FontWeight, text: string) {
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
    return { name: family.replace(/\+/g, " "), data, weight, style: "normal" as const };
  } catch {
    return null;
  }
}

/** Lilita One (un solo peso, 400): titulares y numerales de las tarjetas. */
export function loadDisplayFont(text: string) {
  return loadFont("Lilita+One", 400, text);
}

/** El logotipo `kultura.`: Bricolage Grotesque 700, como en la web. */
export function loadLogoFont() {
  return loadFont("Bricolage+Grotesque", 700, "kultura.");
}

type LoadedFont = NonNullable<Awaited<ReturnType<typeof loadFont>>>;

/**
 * Opción `fonts` de `ImageResponse`. Con una lista VACÍA (Google Fonts no
 * respondió) satori no usa su fuente por defecto y la tarjeta falla con "No
 * fonts are loaded": sin fuentes cargadas se omite la opción para que salga
 * con la fuente por defecto.
 */
export function fontsOption(fonts: Array<LoadedFont | null>): { fonts?: LoadedFont[] } {
  const loaded = fonts.filter((f): f is LoadedFont => f !== null);
  return loaded.length > 0 ? { fonts: loaded } : {};
}
