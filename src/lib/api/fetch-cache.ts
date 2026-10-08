// ============================================================
// KULTURA — Caché de las llamadas a proveedores (E-CATALOGO-CACHE)
//
// En Next 14, un `fetch` que va DESPUÉS de leer cookies (todas las rutas de la
// API comprueban la sesión antes de pedir catálogo) deja de cachearse solo:
// cada visita a Descubrir volvía a consultar en vivo a TMDB, RAWG, Jikan…
// Con `revalidate` explícito la respuesta entra en la Data Cache de Next
// (compartida entre instancias en Vercel) y se reutiliza una hora.
//
// Solo se cachean respuestas 200: un 429 o un 5xx del proveedor no se queda
// pegado una hora (lo garantiza el propio Next).
// ============================================================

/** Una hora: el catálogo no cambia a ritmo de visita. */
export const PROVIDER_REVALIDATE_SECONDS = 3600;

export const PROVIDER_CACHE = { next: { revalidate: PROVIDER_REVALIDATE_SECONDS } } as const;
