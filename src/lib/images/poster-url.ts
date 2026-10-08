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

/** Respaldo: el optimizador de Next, mismo origen. */
function optimizer(src: string, width: number, quality = 70): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

/**
 * `loader` de `next/image`: recibe el `src` original y el ancho que el
 * navegador va a pintar (ya multiplicado por la densidad de pantalla).
 */
export function posterLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
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

  // AniList: /…/cover/{small|medium|large|extraLarge}/… (≈ 50/100/230/460 px)
  if (host === "s4.anilist.co") {
    const size = width <= 100 ? "medium" : width <= 230 ? "large" : "extraLarge";
    return src.replace(/\/cover\/(small|medium|large|extraLarge)\//, `/cover/${size}/`);
  }

  // Open Library: /b/id/{id}-{S|M|L}.jpg (M ≈ 180 px, L ≈ 500 px)
  if (host === "covers.openlibrary.org") {
    return src.replace(/-(S|M|L)\.jpg$/, width <= 180 ? "-M.jpg" : "-L.jpg");
  }

  // MyAnimeList (Jikan) y Google Books: ya llegan en un tamaño de card
  // (~225 px y ~128 px); se sirven directos del CDN.
  if (host === "cdn.myanimelist.net" || host === "books.google.com" || host.endsWith(".googleusercontent.com")) {
    return src;
  }

  // MangaDex sirve miniaturas de 256 y 512 px añadiendo el sufijo al fichero;
  // se pide la miniatura AL optimizador (no se enlaza directo a su CDN).
  if (host === "uploads.mangadex.org" && /\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    const base = src.replace(/\.(256|512)\.jpg$/, "");
    const thumb = `${base}.${width <= 256 ? 256 : 512}.jpg`;
    return optimizer(thumb, width, quality);
  }

  return optimizer(src, width, quality);
}
