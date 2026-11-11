// ============================================================
// KULTURA — Cliente de la API para los componentes (saneamiento 7.1)
//
// `apiFetch` devuelve el `data` de la respuesta o lanza `ApiError` con el
// `code` del catálogo (`src/lib/api/errors.ts`). Solo para rutas ya saneadas:
// las demás siguen con su formato hasta que les toque (Q26).
// ============================================================

import { isApiErrorCode, type ApiErrorCode } from '@/lib/api/errors'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly field?: string
  /** Segundos de `Retry-After` en un 429 (0 si no viene). */
  readonly retryAfter: number

  constructor(code: ApiErrorCode, status: number, opts: { message?: string; field?: string; retryAfter?: number } = {}) {
    super(opts.message ?? code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.field = opts.field
    this.retryAfter = opts.retryAfter ?? 0
  }
}

/** Código de error cuando la respuesta no trae uno del catálogo. */
function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 413) return 'payload_too_large'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 422) return 'invalid_input'
  if (status === 503) return 'unavailable'
  if (status === 502 || status === 504) return 'provider_unavailable'
  return 'internal'
}

/** Convierte una respuesta no-2xx en `ApiError`. */
export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: unknown; message?: unknown; field?: unknown } } | null
  const err = body?.error
  const code = isApiErrorCode(err?.code) ? err.code : codeForStatus(res.status)
  const retryAfter = Number(res.headers.get('Retry-After'))
  return new ApiError(code, res.status, {
    message: typeof err?.message === 'string' ? err.message : undefined,
    field: typeof err?.field === 'string' ? err.field : undefined,
    retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0,
  })
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  /** Se manda como JSON. */
  json?: unknown
}

/**
 * `fetch` a una ruta saneada. Devuelve `data` o lanza `ApiError`; un fallo de
 * red sale como `ApiError('internal', 0)`.
 */
export async function apiFetch<T>(url: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    })
  } catch (e) {
    throw new ApiError('internal', 0, { message: e instanceof Error ? e.message : 'Network error' })
  }
  if (!res.ok) throw await toApiError(res)
  const body = (await res.json().catch(() => null)) as { data?: T } | null
  if (!body || !('data' in body)) throw new ApiError('internal', res.status, { message: 'Malformed response' })
  return body.data as T
}
