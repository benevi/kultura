// ============================================================
// KULTURA — Library Actions (cliente)
// Helpers que hablan con /api/library y sus subrutas (diary, prefs, progress)
// con el contrato de la fase 7: devuelven `data` o lanzan `ApiError`.
// Uso exclusivo en Client Components.
// ============================================================

import type { DiaryConfig, DiaryLog, LibraryEntry, LibraryPayload, LibraryStatus, RatingScale } from '@/types/library'
import { apiFetch } from '@/lib/api/client'
import type { ProgressKind, ProgressPlan, ProgressValue } from '@/lib/library/progress'

/**
 * Elimina un título de la biblioteca del usuario autenticado.
 * `keepalive`: la petición sobrevive al cierre de la página (borrado pendiente).
 * Lanza `ApiError` (`not_found` si ya no estaba).
 */
export async function removeFromLibrary(mediaId: string, { keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
  await apiFetch<null>('/api/library', {
    method: 'DELETE',
    json: { mediaId },
    ...(keepalive ? { keepalive: true } : {}),
  })
}

// ── F-24: notas finas y diario ───────────────────────────────────────────────

export interface SaveLibraryResult {
  entry: LibraryEntry
  /** El apunte del diario creado junto con la entrada, si se pidió y entró. */
  log: DiaryLog | null
  /** Se pidió un apunte y la entrada se guardó, pero el apunte no. */
  logFailed: boolean
}

/**
 * Guarda la entrada (y, si llega `payload.log`, un apunte del diario).
 * Lanza `ApiError` (`provider_unavailable` si el proveedor no respondió).
 */
export async function saveLibraryEntry(payload: LibraryPayload): Promise<SaveLibraryResult> {
  return apiFetch<SaveLibraryResult>('/api/library', { method: 'POST', json: payload })
}

/** Escala (bandera + preferencia) y apuntes del diario de un título. */
export async function fetchDiaryConfig(mediaId: string): Promise<DiaryConfig> {
  return apiFetch<DiaryConfig>(`/api/library/diary?mediaId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
}

export async function deleteDiaryLog(id: string): Promise<void> {
  await apiFetch<null>('/api/library/diary', { method: 'DELETE', json: { id } })
}

export async function saveRatingScale(ratingScale: RatingScale): Promise<void> {
  await apiFetch<{ ratingScale: RatingScale }>('/api/library/prefs', { method: 'PUT', json: { ratingScale } })
}

// ── F-27: progreso por formato ───────────────────────────────────────────────

/** Respuesta de GET /api/library/progress. */
export interface ProgressConfig {
  /** PROGRESS_V2=1 y la migración aplicada: todos los formatos. */
  enabled: boolean
  kind: ProgressKind | null
  progress: ProgressValue | null
  /** Total de la unidad principal para el progreso actual (temporada en series). */
  total: number | null
  plan: ProgressPlan | null
  /** Series: el episodio que toca ahora, con su nombre de TMDB. */
  next: { season: number; episode: number; name: string | null; airDate: string | null } | null
  /** El diario de F-24 está activo (se puede apuntar al completar). */
  diary: boolean
}

export async function fetchProgressConfig(mediaId: string): Promise<ProgressConfig> {
  return apiFetch<ProgressConfig>(`/api/library/progress?mediaId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
}

export interface AdvanceResult {
  progress: ProgressValue | null
  status: LibraryStatus
  /** Lo marcado es el final: proponer «Completado». */
  finished: boolean
  /** Serie al día: no hay más episodios emitidos. */
  caughtUp: boolean
  diary: boolean
}

/**
 * «Marcar siguiente» (episodio, capítulo, páginas, %, hora). Lanza `ApiError`;
 * `conflict` con `message: 'progress_unavailable'` si ese formato no tiene
 * progreso todavía.
 */
export async function advanceProgress(mediaId: string): Promise<AdvanceResult> {
  return apiFetch<AdvanceResult>('/api/library/progress', { method: 'POST', json: { mediaId, action: 'next' } })
}

/** Pasa a «Completado» (y, si se pide y el diario está activo, lo apunta). */
export async function completeFromProgress(
  mediaId: string,
  options: { log: boolean; watchedOn?: string }
): Promise<{ log: DiaryLog | null; logFailed: boolean }> {
  const data = await apiFetch<{ log: DiaryLog | null; logFailed: boolean }>('/api/library/progress', {
    method: 'POST',
    json: { mediaId, action: 'complete', log: options.log, watchedOn: options.watchedOn },
  })
  return { log: data.log ?? null, logFailed: data.logFailed === true }
}
