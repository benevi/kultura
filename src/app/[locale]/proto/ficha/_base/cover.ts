// Prototipo fase 8.3 — de dónde se pide la portada y si un canvas puede leerla.
// Mismo criterio que la app (`posterLoader`): MangaDex, ComicVine y Steam por
// el optimizador (`/_next/image`, mismo origen); el resto, directa al CDN.

import { posterLoader } from "@/lib/images/poster-url";
import type { MediaType } from "@/types/media";
import type { CoverSource } from "./types";

/** Hosts que sirven la imagen con `Access-Control-Allow-Origin` (comprobado el 18-11-2026). */
const CORS_HOSTS = ["image.tmdb.org", "media.rawg.io", "covers.openlibrary.org", "s4.anilist.co"];

// Anchos que el optimizador acepta (los de `next/image` por defecto); TMDB no pasa de 780.
const WIDTHS = [384, 640, 750, 1200];

export function coverSource(poster: string | undefined, type: MediaType): CoverSource | null {
  if (!poster) return null;
  let host = "";
  try {
    host = new URL(poster).hostname;
  } catch {
    return null;
  }
  // AniList: la API da la portada mediana (~230 px); la grande vive en `/cover/large/`
  // (ver `posterLoader`). A pantalla completa hace falta la grande.
  if (host === "s4.anilist.co") poster = poster.replace("/cover/medium/", "/cover/large/");
  const at = (width: number) => posterLoader({ src: poster, width });
  const src = at(750);
  const viaOptimizer = src.startsWith("/_next/image");
  const direct = CORS_HOSTS.includes(host);
  const seen = new Set<string>();
  const srcSet = WIDTHS.filter((w) => host !== "image.tmdb.org" || w <= 750).map((w) => ({ url: at(w), w }))
    .filter(({ url }) => (seen.has(url) ? false : (seen.add(url), true)))
    .map(({ url, w }) => `${url} ${w}w`)
    .join(", ");
  const canvasSafe = viaOptimizer || direct;
  return {
    original: poster,
    src,
    srcSet,
    small: at(256),
    canvasSafe,
    // Sin CORS (Google Books): no se amplía el optimizador a otros proveedores (sería un
    // uso nuevo, dictamen legal del 18-11-2026). La lectura falla y queda la paleta neutra.
    sample: at(256),
    shape: type === "game" ? "landscape" : "portrait",
    // MangaDex: `posterLoader` pide la miniatura de 512 px (`….jpg.512.jpg`), que a 2× se
    // ve blanda. Para la Pieza, el original por la MISMA ruta (el optimizador, mismo host).
    hi:
      host === "uploads.mangadex.org"
        ? `/_next/image?url=${encodeURIComponent(poster.replace(/(\.(?:jpe?g|png|webp))\.(?:256|512)\.jpg$/i, "$1"))}&w=1200&q=75`
        : at(1200),
  };
}
