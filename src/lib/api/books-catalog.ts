// ============================================================
// KULTURA — Recolector de catálogo de libros (E-BOOKS-LANG)
//
// Por qué existe: en Google Books el idioma real y el año NO se pueden pedir
// en la consulta. `langRestrict` es solo una pista para el índice y no hay
// operador de fecha, así que ambos se aplican DESPUÉS de recibir la respuesta.
// Con una petición de 20 por página eso daba tres síntomas que parecían
// independientes y eran el mismo problema:
//
//   1. Títulos en inglés — el recorte por idioma no podía ser duro sin dejar
//      la rejilla casi vacía, así que se colaban ediciones de otro idioma.
//   2. El filtro de año no devolvía nada — pedía 2026 y miraba solo los 20
//      títulos de esa página; si ninguno era de 2026, página en blanco aunque
//      el catálogo tuviera libros de 2026 diez posiciones más allá.
//   3. Error al paginar hondo — `totalItems` es una ESTIMACIÓN y Google deja
//      de servir bastante antes de ese número. La app ofrecía las páginas que
//      decía el total y el proveedor las rechazaba.
//
// La solución es la misma para los tres: pedir al proveedor mucho más de lo
// que se enseña. Cada página de la app barre varias ventanas de 40, filtra, y
// se queda con las primeras 20 que sobreviven. Así el filtro por idioma puede
// ser duro, el año tiene material de verdad donde buscar, y el final del
// catálogo se detecta al recorrerlo en vez de creerse el total.
// ============================================================

import type { MediaItem } from "@/types/media";
import {
  fetchGoogleBooksWindow,
  GoogleBooksError,
  GOOGLE_BOOKS_MAX_RESULTS,
  GOOGLE_BOOKS_PAGE_SIZE,
} from "@/lib/api/googlebooks";
import { normalizeBookGoogle } from "@/lib/api/normalizer";
import { filterBooksByLanguage } from "@/lib/api/books-maps";

/**
 * Ventanas de proveedor que barre cada página de la app.
 *
 * 2 × 40 = 80 candidatos para enseñar 20. Es el margen que permite que el
 * filtro de idioma sea duro sin vaciar la rejilla. Subirlo da más densidad y
 * cuesta una petición más por página; bajarlo devuelve el problema original.
 */
const WINDOWS_PER_PAGE = 2;

/** Candidatos crudos que barre una página de la app. */
const SCAN_SPAN = WINDOWS_PER_PAGE * GOOGLE_BOOKS_MAX_RESULTS;

/**
 * Hasta dónde sirve Google de verdad, en posiciones del catálogo.
 *
 * Es un valor EMPÍRICO, no documentado por Google: `totalItems` llega a
 * anunciar varios cientos más de los que luego entrega. Se usa solo para no
 * ofrecer páginas que el proveedor va a rechazar; si corta antes, el propio
 * barrido lo detecta y cierra la paginación en su sitio.
 */
const MAX_SERVED_INDEX = 400;

/** Páginas de la app que caben dentro de lo que el proveedor sirve. */
export const BOOKS_MAX_PAGES = Math.max(
  1,
  Math.floor(MAX_SERVED_INDEX / SCAN_SPAN)
);

export interface CollectBooksPageParams {
  /** Consulta ya construida (`subject:"…"`, `inpublisher:"…"`…). */
  q: string;
  /** Params extra de la consulta (orderBy, filter, langRestrict override). */
  params: Record<string, string>;
  /** Página de la app, 1-indexada. */
  page: number;
  /** Locale activo, para el `langRestrict` de la petición. */
  locale?: string | null;
  /** Idioma REAL exigido al volumen (ISO-639-1). */
  lang: string;
  /** Post-filtro de año ya resuelto, o `undefined` si no hay año activo. */
  yearMatcher?: (year: number | undefined) => boolean;
}

export interface CollectBooksPageResult {
  items: MediaItem[];
  /** ¿Queda catálogo por detrás de esta página? */
  hasMore: boolean;
  /** Estimación de Google, sin depurar — el llamante decide qué hacer con ella. */
  totalItems: number | undefined;
}

/**
 * ¿Este fallo significa "te has salido del catálogo" en vez de "el servicio
 * está roto"?
 *
 * Google devuelve 400 cuando el `startIndex` se va más allá de lo que puede
 * servir. Eso NO es un error que deba ver el usuario: es el final de la lista.
 * Cualquier otro código (429 de cuota, 5xx) sí es un fallo real y se propaga
 * para que Descubrir pinte su aviso.
 */
function isBeyondCatalogue(e: unknown): boolean {
  return e instanceof GoogleBooksError && e.status === 400;
}

/**
 * Reúne una página de libros ya filtrada por idioma y año.
 *
 * Nunca devuelve una página vacía por culpa del filtro de idioma: si el
 * barrido no encuentra ninguna edición en el idioma pedido pero sí hay libros,
 * se sirven esos. Vale más un título en otro idioma que una rejilla en blanco.
 */
export async function collectBooksPage({
  q,
  params,
  page,
  locale,
  lang,
  yearMatcher,
}: CollectBooksPageParams): Promise<CollectBooksPageResult> {
  const base = Math.max(0, page - 1) * SCAN_SPAN;

  const collected: MediaItem[] = [];
  /** Supervivientes del año pero NO del idioma — red de seguridad. */
  const fallback: MediaItem[] = [];
  let totalItems: number | undefined;
  let exhausted = false;

  for (let i = 0; i < WINDOWS_PER_PAGE; i++) {
    const startIndex = base + i * GOOGLE_BOOKS_MAX_RESULTS;
    if (startIndex >= MAX_SERVED_INDEX) {
      exhausted = true;
      break;
    }

    let res;
    try {
      res = await fetchGoogleBooksWindow(q, startIndex, params, locale);
    } catch (e) {
      // Fuera de catálogo → se acabó la lista, sin aviso de error. Un 429 o un
      // 5xx sí sube: es un fallo que el usuario tiene que ver.
      if (isBeyondCatalogue(e)) {
        exhausted = true;
        break;
      }
      throw e;
    }

    if (totalItems === undefined) totalItems = res.totalItems;

    const raw = res.items ?? [];
    if (raw.length === 0) {
      exhausted = true;
      break;
    }

    let window = raw.map((v) => normalizeBookGoogle(v));
    if (yearMatcher) window = window.filter((b) => yearMatcher(b.year));

    const inLanguage = filterBooksByLanguage(window, lang);
    collected.push(...inLanguage);
    if (inLanguage.length < window.length) {
      fallback.push(...window.filter((b) => !inLanguage.includes(b)));
    }

    if (collected.length >= GOOGLE_BOOKS_PAGE_SIZE) break;
    // Una ventana más corta que el máximo significa que no hay más detrás.
    if (raw.length < GOOGLE_BOOKS_MAX_RESULTS) {
      exhausted = true;
      break;
    }
  }

  const source = collected.length > 0 ? collected : fallback;
  const items = source.slice(0, GOOGLE_BOOKS_PAGE_SIZE);

  return {
    items,
    hasMore: !exhausted && page < BOOKS_MAX_PAGES,
    totalItems,
  };
}

/** `totalItems` del proveedor → páginas navegables con este barrido. */
export function booksTotalPages(totalItems: number | undefined): number {
  if (!totalItems || totalItems <= 0) return 1;
  return Math.min(
    Math.max(Math.ceil(totalItems / SCAN_SPAN), 1),
    BOOKS_MAX_PAGES
  );
}
