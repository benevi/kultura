// ============================================================
// KULTURA — Resultado de los servicios (saneamiento 6.3)
// Los servicios de `src/lib/<módulo>/service.ts` no conocen HTTP: devuelven
// el valor o un código del catálogo, y la ruta lo convierte en respuesta.
// ============================================================

import type { ApiErrorCode } from '@/lib/api/errors'

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: ApiErrorCode; message?: string; field?: string }

export function success<T>(value: T): ServiceResult<T> {
  return { ok: true, value }
}

export function failure<T = never>(
  code: ApiErrorCode,
  opts: { message?: string; field?: string } = {}
): ServiceResult<T> {
  return { ok: false, code, ...opts }
}
