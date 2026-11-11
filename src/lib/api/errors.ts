// ============================================================
// KULTURA — Catálogo de errores de la API (saneamiento 7.1)
//
// Todas las rutas saneadas responden con el mismo formato:
//   éxito  → { data }
//   error  → { error: { code, message?, field? } }
// `code` es estable y es lo que mira el cliente; `message` es solo para
// depurar (en inglés, no se enseña al usuario) y `field` señala el campo del
// cuerpo o de la query que no vale.
//
// Este módulo no importa nada de Next: lo comparten servidor y cliente.
// ============================================================

/** Código de error → estado HTTP por defecto. */
export const API_ERRORS = {
  /** Sin sesión. */
  unauthenticated: 401,
  /** Con sesión, pero sin permiso sobre el recurso (RLS, no es miembro…). */
  forbidden: 403,
  /** El recurso no existe (o no se puede ver). */
  not_found: 404,
  /** El cuerpo no es JSON. */
  invalid_json: 400,
  /** El cuerpo o la query no cumplen el esquema (`field` dice cuál). */
  invalid_input: 400,
  /** Ya existe (amistad repetida, nombre en uso…). */
  conflict: 409,
  /** El cuerpo pasa del tope de la ruta (importaciones). */
  payload_too_large: 413,
  /** Demasiadas peticiones (lleva `Retry-After`). */
  rate_limited: 429,
  /** No se puede hacer ahora (p. ej. programar el borrado): reintentar. */
  unavailable: 503,
  /** Un proveedor externo (TMDB, RAWG…) no respondió: se puede reintentar. */
  provider_unavailable: 502,
  /** Fallo nuestro (base de datos, bug). */
  internal: 500,
} as const

export type ApiErrorCode = keyof typeof API_ERRORS

export interface ApiErrorPayload {
  code: ApiErrorCode
  message?: string
  field?: string
}

export interface ApiErrorBody {
  error: ApiErrorPayload
}

export interface ApiSuccessBody<T> {
  data: T
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(API_ERRORS, value)
}
