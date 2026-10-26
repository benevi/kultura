// ============================================================
// KULTURA — Límites del importador (F-26). Anti abuso y cupos de proveedores.
//
// En el navegador: tamaño del archivo y número de filas (lo que se lee). En
// el servidor, que es lo que de verdad protege: filas y bytes por lote,
// longitud de cada campo, presupuesto de peticiones a proveedores por lote y
// límite de lotes por usuario compartido entre instancias
// (`checkRateLimitDistributed`).
//
// Cuentas: una biblioteca de 10.000 títulos son 200 lotes de 50, que caben en
// la ventana de una hora (240). Un script que machacara la ruta conseguiría
// como mucho 240 × 120 = 28.800 peticiones a proveedores por hora, y todas
// pasan por el circuito y la caché de `src/lib/api/http.ts`.
// ============================================================

/** Tamaño máximo del archivo (ZIP, CSV o XML; un .xml.gz se mide descomprimido). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Tamaño máximo descomprimido de lo que se lee dentro de un ZIP o .gz. */
export const MAX_UNPACKED_BYTES = 40 * 1024 * 1024
/** Archivos como mucho dentro de un ZIP (el de Letterboxd trae ~15). */
export const MAX_ZIP_ENTRIES = 200
/** Títulos por importación (lo que pase se avisa y se puede importar luego). */
export const MAX_IMPORT_ITEMS = 10_000

/** Filas por lote (petición al servidor). */
export const BATCH_SIZE = 50
/** Bytes por lote: 50 filas con reseñas largas caben de sobra. */
export const MAX_BATCH_BYTES = 512 * 1024
/** Apuntes de diario por título y lote. */
export const MAX_LOGS_PER_ITEM = 50
export const MAX_TITLE_LENGTH = 300
export const MAX_AUTHOR_LENGTH = 200

/** Peticiones a proveedores por lote (búsqueda + ficha). */
export const MAX_PROVIDER_CALLS_PER_BATCH = 120
/**
 * Tiempo para emparejar y crear fichas en un lote. Lo que no entra queda
 * `pending` y el navegador lo reintenta: ninguna petición se acerca al límite
 * de la función (`maxDuration` de la ruta).
 */
export const BATCH_DEADLINE_MS = 25_000

/** Peticiones simultáneas por proveedor dentro de un lote. */
export const PROVIDER_CONCURRENCY = {
  tmdb: 6,
  openlibrary: 3,
  anilist: 1,
  jikan: 2,
} as const

/** Lotes por usuario: compartido entre instancias (Upstash) o en memoria. */
export const IMPORT_BATCH_LIMIT = { windowMs: 60 * 60_000, max: 240 }
/** Exportación CSV para Letterboxd: como la JSON, 5 por hora. */
export const IMPORT_EXPORT_LIMIT = { windowMs: 60 * 60_000, max: 5 }

/** Reintentos de las filas `pending` (con espera creciente) antes de dejarlas. */
export const PENDING_ROUNDS = 3
