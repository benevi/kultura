// ============================================================
// KULTURA — URL de portada al tamaño justo (E-PORTADAS-RAPIDAS)
//
// Todas las portadas pasaban por el optimizador de imágenes de Vercel
// (`/_next/image`). En frío, eso es: descargar el ORIGINAL del proveedor,
// redimensionarlo y servirlo — cientos de ms por portada, y con RAWG el
// original es una captura de 1920 px de varios cientos de KB. Mientras, la
// card se quedaba en su gradiente.
//
// Casi todos los proveedores ya sirven la portada en varios tamaños desde su
// propio CDN, siempre caliente. Este loader pide directamente el tamaño
// nativo más pequeño que cubre el ancho que pide `next/image`, y solo cae al
// optimizador para los hosts sin tamaños (o en los que no conviene enlazar
// directo: MangaDex y ComicVine).
//
// Es una función pura para poder usarla como `loader` de `next/image` y
// probarla sin navegador.
// ============================================================

/** Anchos que sirve el CDN de TMDB para pósteres. */
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780] as const;
/** Anchos del endpoint de redimensionado de RAWG. */
const RAWG_WIDTHS = [200, 420, 640, 1280] as const;

function pick(widths: readonly number[], want: number): number | null {
  for (const w of widths) if (w >= want) return w;
  return null;
}

/**
 * Anchos que se piden al optimizador (cupo de Vercel Hobby, 5.000
 * transformaciones al mes). Cada combinación de imagen, ancho y calidad es una
 * transformación aparte, y `next/image` ofrece hasta 16 anchos en el `srcset`
 * (de 16 a 3840): cada pantalla pedía el suyo. Redondeando HACIA ARRIBA a tres
 * cubos, cada portada cuesta como mucho tres. Por encima de 1080 se sirve 1080:
 * el optimizador nunca amplía, y las fuentes que pasan por aquí (miniaturas de
 * MangaDex de 512 px, capturas de Steam de 600 px, portadas `medium` de
 * ComicVine) no llegan a ese ancho. Son anchos de `images.deviceSizes`/
 * `imageSizes` por defecto (el optimizador rechaza los demás).
 */
export const OPTIMIZER_WIDTHS = [256, 640, 1080] as const;

/** Calidad única del optimizador (`images.qualities` en next.config). */
export const OPTIMIZER_QUALITY = 70;

function optimizerWidth(width: number): number {
  return pick(OPTIMIZER_WIDTHS, width) ?? OPTIMIZER_WIDTHS[OPTIMIZER_WIDTHS.length - 1];
}

/**
 * Respaldo: el optimizador de Next, mismo origen, con el ancho redondeado a
 * `OPTIMIZER_WIDTHS` y una sola calidad (`quality` se ignora: otra calidad
 * sería otra transformación, y next.config solo acepta `OPTIMIZER_QUALITY`).
 */
function optimizer(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${optimizerWidth(width)}&q=${OPTIMIZER_QUALITY}`;
}

/**
 * `loader` de `next/image`: recibe el `src` original y el ancho que el
 * navegador va a pintar (ya multiplicado por la densidad de pantalla).
 */
export function posterLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src; // relativa o rara: se sirve tal cual
  }
  const host = url.hostname;

  // TMDB: /t/p/{tamaño}/{fichero}
  if (host === "image.tmdb.org") {
    const m = url.pathname.match(/^\/t\/p\/[^/]+(\/.+)$/);
    if (m) {
      const w = pick(TMDB_WIDTHS, width);
      return `https://image.tmdb.org/t/p/${w ? `w${w}` : "original"}${m[1]}`;
    }
    return src;
  }

  // RAWG: /media/games/… → /media/resize/{ancho}/-/games/…
  if (host === "media.rawg.io") {
    const m = url.pathname.match(/^\/media\/(?:resize\/\d+\/-\/|crop\/\d+\/\d+\/)?(.+)$/);
    if (m) {
      const w = pick(RAWG_WIDTHS, width);
      return w ? `https://media.rawg.io/media/resize/${w}/-/${m[1]}` : `https://media.rawg.io/media/${m[1]}`;
    }
    return src;
  }

  // AniList: SE SIRVE TAL CUAL. Sus carpetas de tamaño van desplazadas
  // respecto a los nombres de la API (`extraLarge` vive en `/cover/large/`,
  // `large` en `/cover/medium/`…) y `/cover/extraLarge/` NO existe: reescribir
  // el segmento dejó Descubrir → Anime vacío (todas las portadas en 404 y las
  // cards retiradas). La que llega ya es la grande del CDN, directa y caliente.
  if (host === "s4.anilist.co") {
    return src;
  }

  // Open Library: /b/id/{id}-{S|M|L}.jpg (M ≈ 180 px, L ≈ 500 px)
  if (host === "covers.openlibrary.org") {
    return src.replace(/-(S|M|L)\.jpg$/, width <= 180 ? "-M.jpg" : "-L.jpg");
  }

  // Google Books: ya llega en un tamaño de card (~128 px); se sirve directo
  // del CDN.
  if (host === "books.google.com" || host.endsWith(".googleusercontent.com")) {
    return src;
  }

  // MangaDex sirve miniaturas de 256 y 512 px añadiendo el sufijo al fichero;
  // se pide la miniatura AL optimizador (no se enlaza directo a su CDN).
  if (host === "uploads.mangadex.org" && /\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    const base = src.replace(/\.(256|512)\.jpg$/, "");
    const small = width <= 256;
    const thumb = `${base}.${small ? 256 : 512}.jpg`;
    // La miniatura grande mide 512 px: con 640 basta (1080 sería la misma
    // imagen con otra transformación).
    return optimizer(thumb, small ? 256 : 640);
  }

  return optimizer(src, width);
}

/**
 * Anchos de TMDB para imágenes apaisadas (`backdrop_sizes` de su
 * `/configuration`). `w1280` es el tope: `original` puede pasar de 3 000 px y
 * varios MB, y la sala no lo necesita (biblia §2, fase 8.5 F2a).
 */
const TMDB_BACKDROP_WIDTHS = [300, 780, 1280] as const;

/**
 * `loader` de `next/image` para la imagen apaisada de la sala (los fondos de
 * TMDB y el arte de RAWG): el ancho nativo más pequeño que cubre el que se
 * pide, con 1280 como tope. Las demás imágenes van como en `posterLoader`,
 * que no cambia.
 */
export function backdropLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.hostname === "image.tmdb.org") {
    const m = url.pathname.match(/^\/t\/p\/[^/]+(\/.+)$/);
    if (m) {
      const w = pick(TMDB_BACKDROP_WIDTHS, width) ?? TMDB_BACKDROP_WIDTHS[TMDB_BACKDROP_WIDTHS.length - 1];
      return `https://image.tmdb.org/t/p/w${w}${m[1]}`;
    }
    return src;
  }
  // RAWG: el mismo endpoint de redimensionado, con 1280 de tope (sin él, la captura original, de 1920 px o más).
  if (url.hostname === "media.rawg.io") {
    const m = url.pathname.match(/^\/media\/(?:resize\/\d+\/-\/|crop\/\d+\/\d+\/)?(.+)$/);
    if (m) {
      const w = pick(RAWG_WIDTHS, width) ?? RAWG_WIDTHS[RAWG_WIDTHS.length - 1];
      return `https://media.rawg.io/media/resize/${w}/-/${m[1]}`;
    }
    return src;
  }
  return posterLoader({ src, width });
}
