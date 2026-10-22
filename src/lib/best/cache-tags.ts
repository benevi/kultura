// KULTURA — Etiquetas y versión de caché de los rankings (F-06, COD-9).
// Módulo sin dependencias para que `POST /api/revalidate` no cargue el
// catálogo entero solo por conocer el nombre de la etiqueta.

/** Etiqueta de todas las cachés de /best. `POST /api/revalidate` la vacía. */
export const BEST_CACHE_TAG = "best-of";

/**
 * Súbela al cambiar la forma o el ORDEN de lo cacheado (v7: media ponderada,
 * DAT-4; antes `best-of-v6`).
 */
export const BEST_CACHE_VERSION = "best-of-v7";

/** Etiqueta de las portadas de la landing (la aplica `lib/landing/showcase.ts`). */
export const SHOWCASE_CACHE_TAG = "showcase";

/** Etiquetas que `POST /api/revalidate` acepta. */
export const REVALIDATABLE_TAGS: readonly string[] = [BEST_CACHE_TAG, SHOWCASE_CACHE_TAG];
