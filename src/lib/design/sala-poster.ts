// ============================================================
// KULTURA — La vertical que llena la sala (fase 8.5, F4; biblia §2)
// ------------------------------------------------------------
// Una película, serie, juego o anime sin imagen apaisada llena la sala con
// su imagen vertical: se pide en su resolución original, se ajusta al ancho
// de la pantalla y se recorta por la zona de interés. Pero ninguna imagen se
// amplía más de 1,25 veces su tamaño natural: donde no da para llenar la sala
// sin pasar de ese tope, la obra se compone como un libro (la portada entera
// sobre su campo de color, con el título debajo).
//
// La vertical (2:3) es más alta que la sala a cualquier ancho (4:5, 16:9,
// 2:1), así que al llenarla la imagen se pinta al ancho de la ventana: llena
// hasta un ancho de ventana de `1,25 × ancho natural`. Ese límite se redondea
// hacia abajo a uno de los pasos de `SALA_POSTER_FILL_STEPS` y va en el HTML
// (`data-sala-fill`); la hoja `poster.css` (`sala-poster-css.ts`) pasa a «libro» por
// encima de él. Un solo HTML para las dos composiciones: un solo `h1` y una
// sola imagen.
//
// El ancho natural se sabe de antemano en AniList (460 px la grande); en el
// resto (TMDB `original`, RAWG) no, y se da por bueno: `SalaFichaImage` lo
// mide al cargar y, si no llega, baja el paso.
// Sin dependencias: lo usa también `SalaFichaImage`, en el cliente.
// ============================================================

/** Ninguna imagen se amplía más de esto (biblia §2). */
export const SALA_POSTER_MAX_SCALE = 1.25;

/** Anchos de ventana (px) hasta los que puede llenar la sala; por encima, libro. */
export const SALA_POSTER_FILL_STEPS = [480, 640, 768, 1024, 1280, 1536] as const;

/** `none`: nunca llena (libro); `all`: siempre (o aún no se sabe). */
export type SalaPosterFill = "none" | "all" | `${(typeof SALA_POSTER_FILL_STEPS)[number]}`;

/** Ancho de la portada en la composición de libro (la de la pieza de hoy). */
export const SALA_POSTER_BOOK_WIDTH_REM = 22;

/** El paso hasta el que llena una imagen de `width` px de ancho natural. */
export function salaPosterFill(width: number | null): SalaPosterFill {
  if (width === null || !Number.isFinite(width)) return "all";
  const limit = width * SALA_POSTER_MAX_SCALE;
  let fill: SalaPosterFill = "none";
  for (const step of SALA_POSTER_FILL_STEPS) if (step <= limit) fill = `${step}`;
  return fill;
}

/**
 * La vertical en su mayor resolución y su ancho natural, si se sabe.
 *
 * AniList: lo que guarda la obra es `large` (carpeta `/cover/medium/`, 230
 * px); la grande (`extraLarge`) vive en `/cover/large/` y mide 460 px de
 * ancho (comprobado con la API y el CDN el 23-11-2026). Ojo: no existe
 * `/cover/extraLarge/` (ver `posterLoader`).
 */
export function salaPosterSource(src: string): { src: string; width: number | null } {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return { src, width: null };
  }
  if (url.hostname === "s4.anilist.co") {
    const large = src.replace("/cover/medium/", "/cover/large/");
    return { src: large, width: large.includes("/cover/large/") ? 460 : 230 };
  }
  return { src, width: null };
}

/** `sizes` de la imagen: a todo el ancho mientras llena; luego, la portada de libro. */
export function salaPosterSizes(fill: SalaPosterFill): string {
  const book = `${SALA_POSTER_BOOK_WIDTH_REM}rem`;
  if (fill === "all") return "100vw";
  if (fill === "none") return book;
  return `(max-width: ${fill}px) 100vw, ${book}`;
}
