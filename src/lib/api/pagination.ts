// ============================================================
// KULTURA — Parámetros de paginación de Descubrir (E79-s3)
//
// Módulo sin dependencias a propósito: `discover.ts` y `aggregate.ts` se
// importan mutuamente (el agregado reusa el pipeline por familia), así que las
// constantes compartidas viven aquí para no añadir otra arista a ese ciclo.
// ============================================================

/** Ítems por página, igual en todas las familias y en el agregado `all`. */
export const PAGE_SIZE = 20;

/**
 * Tope COMÚN de páginas navegables, para las 7 familias y para el agregado.
 *
 * Antes cada familia tenía su propio techo, y de ahí la incoherencia que
 * reportó el usuario: "películas" ofrecía ~500 páginas, "libros" 50, cómic y
 * juegos ninguno (se exponía el conteo crudo del proveedor: RAWG count=900360 →
 * 45018 páginas fantasma) y el agregado "todos" ~5-7.
 *
 * ¿Por qué 100? Es un parámetro técnico/UX, no de marca:
 *   - 100 × 20 = 2000 ítems por familia: un orden de magnitud por encima de lo
 *     que recorre cualquier sesión real.
 *   - Está por DEBAJO del tope servible de todos los proveedores (TMDB sirve
 *     500; Jikan, Google Books, ComicVine y RAWG se agotan antes o alrededor),
 *     así que `min(tope del proveedor, 100)` nunca ofrece en la UI una última
 *     página que devolvería 4xx o vacío.
 *   - Es alcanzable por el agregado con el esquema de rondas de `aggregate.ts`
 *     (~25 rondas nativas), así que "todos" deja de quedarse en 5-7 páginas.
 */
export const DISCOVER_MAX_PAGES = 100;
