// ============================================================
// KULTURA — Portadas de los rankings /best (D-10, REN-1)
//
// En el catálogo las portadas de AniList se sirven tal cual (`posterLoader`):
// el optimizador de Vercel Hobby solo tiene 5.000 transformaciones al mes y
// Descubrir enseña cientos de portadas distintas. En /best sí compensa: son
// pocas (20 por ranking, siempre las mismas durante días) y cada original de
// AniList pesa 100-560 KB (PNG), así que con el scroll completo la página
// bajaba 4,41 MB de imágenes (VERIF-D R8).
//
// Para acotar el cupo, el ancho se redondea a DOS cubos: la miniatura de la
// lista (256) y la del podio (640). Así cada portada genera como mucho dos
// transformaciones, y con `minimumCacheTTL` de 7 días (next.config) se
// reutilizan toda la semana: ≤ 20 × 2 × 12 rankings ≈ 480 por semana.
//
// TMDB y RAWG ya sirven el tamaño justo desde su CDN: siguen sin optimizador.
// ============================================================

import { posterLoader } from "@/lib/images/poster-url";

/** Anchos permitidos por `images.imageSizes`/`deviceSizes` por defecto de Next. */
export const BEST_POSTER_BUCKETS = [256, 640] as const;

/** Hosts cuyo original es pesado y sin tamaños en el CDN. */
const OPTIMIZED_HOSTS = new Set(["s4.anilist.co"]);

function bucket(width: number): number {
  for (const w of BEST_POSTER_BUCKETS) if (width <= w) return w;
  return BEST_POSTER_BUCKETS[BEST_POSTER_BUCKETS.length - 1];
}

/** `loader` de `next/image` para las portadas de /best. Función pura. */
export function bestPosterLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  let host = "";
  try {
    host = new URL(src).hostname;
  } catch {
    return posterLoader({ src, width, quality });
  }
  if (!OPTIMIZED_HOSTS.has(host)) return posterLoader({ src, width, quality });
  return `/_next/image?url=${encodeURIComponent(src)}&w=${bucket(width)}&q=${quality ?? 70}`;
}
