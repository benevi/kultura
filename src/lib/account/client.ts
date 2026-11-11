// ============================================================
// KULTURA — Cliente de /api/account (saneamiento 6 y 7)
// Devuelven `data` o lanzan `ApiError` (con `code`, `message` y `status`).
// Las descargas (/export y /export/letterboxd) siguen con `fetch`: el cuerpo
// es el fichero.
// ============================================================

import { ApiError, apiFetch } from '@/lib/api/client'
import type { ImportBatchRequest, ImportBatchResponse } from '@/lib/import/types'
import type { SendResult } from '@/lib/import/run'

export interface DeletionSummary {
  library: number
  lists: number
  messages: number
  friends: number
  groups: Array<{ name: string; successor: string | null }> | null
  sharedLists: Array<{ name: string; successor: string | null }> | null
  graceDays: number
  deletionRequestedAt: string | null
}

export type AccountDeleteResult =
  | { scheduled: true; purgeAt: string }
  | { scheduled: false; transferred: { groups: number; lists: number } | null }

export interface KulturaImportResult {
  libraryImported: number
  librarySkipped: number
  libraryUnresolved: number
  libraryFailed: number
  libraryFailedIds: string[]
  listsImported: number
  listItemsFailed: number
  diaryImported: number
  diaryFailed: number
  sectionsFailed?: Array<'lists' | 'diary'>
  friendshipsImported: 0
}

/** Resumen para el modal de borrado. */
export function fetchDeletionSummary(): Promise<DeletionSummary> {
  return apiFetch('/api/account')
}

/** Borra (o programa el borrado de) la cuenta. Errores: ver `ACCOUNT_ERRORS`. */
export function deleteAccount(password: string): Promise<AccountDeleteResult> {
  return apiFetch('/api/account', { method: 'DELETE', json: password ? { password } : {} })
}

export async function cancelAccountDeletion(): Promise<void> {
  await apiFetch('/api/account', { method: 'PATCH', json: { cancel_deletion: true } })
}

/** Reimporta el JSON de /api/account/export (tal cual se leyó del fichero). */
export function importKulturaExport(file: unknown): Promise<KulturaImportResult> {
  return apiFetch('/api/account/import', { method: 'POST', json: file })
}

/**
 * Un lote del importador de otras apps. No lanza: el orquestador (`runImport`)
 * decide por el estado (401, 403, 400/413, 429 con `Retry-After`…); un fallo
 * de red sale con estado 0.
 */
export async function sendImportBatch(request: ImportBatchRequest, signal?: AbortSignal): Promise<SendResult> {
  try {
    const data = await apiFetch<ImportBatchResponse>('/api/account/import/external', {
      method: 'POST',
      json: request,
      signal,
    })
    return { ok: true, data }
  } catch (err) {
    if (signal?.aborted) throw err
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, retryAfterSeconds: err.retryAfter || undefined }
    }
    return { ok: false, status: 0 }
  }
}
