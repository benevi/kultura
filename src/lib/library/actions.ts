// ============================================================
// KULTURA — Library Actions (cliente)
// Helpers que hacen fetch al Route Handler /api/library.
// Uso exclusivo en Client Components.
// ============================================================

import type { DiaryConfig, DiaryLog, LibraryEntry, LibraryPayload, LibraryStatus, RatingScale } from '@/types/library'
import type { ProgressKind, ProgressPlan, ProgressValue } from '@/lib/library/progress'

/** Añade un título a la biblioteca del usuario autenticado */
export async function addToLibrary(payload: LibraryPayload): Promise<LibraryEntry> {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to add to library')
  }

  const data = await response.json() as { entry: LibraryEntry }
  return data.entry
}

/** Actualiza una entrada existente en la biblioteca del usuario autenticado */
export async function updateLibrary(payload: LibraryPayload): Promise<LibraryEntry> {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to update library entry')
  }

  const data = await response.json() as { entry: LibraryEntry }
  return data.entry
}

/** Elimina un título de la biblioteca del usuario autenticado */
/** `keepalive`: la petición sobrevive al cierre de la página (borrado pendiente). */
export async function removeFromLibrary(mediaId: string, { keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
  const response = await fetch('/api/library', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId }),
    ...(keepalive ? { keepalive: true } : {}),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to remove from library')
  }
}

// ── F-24: notas finas y diario ───────────────────────────────────────────────

async function failure(response: Response, fallback: string): Promise<Error> {
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  return new Error(data.error ?? fallback)
}

export interface SaveLibraryResult {
  entry: LibraryEntry
  /** El apunte del diario creado junto con la entrada, si se pidió y entró. */
  log: DiaryLog | null
  /** Se pidió un apunte y la entrada se guardó, pero el apunte no. */
  logFailed: boolean
}

/** Guarda la entrada (y, si llega `payload.log`, un apunte del diario). */
export async function saveLibraryEntry(payload: LibraryPayload): Promise<SaveLibraryResult> {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await failure(response, 'Failed to save library entry')
  const data = (await response.json()) as { entry: LibraryEntry; log?: DiaryLog | null; logFailed?: boolean }
  return { entry: data.entry, log: data.log ?? null, logFailed: data.logFailed === true }
}

/** Escala (bandera + preferencia) y apuntes del diario de un título. */
export async function fetchDiaryConfig(mediaId: string): Promise<DiaryConfig> {
  const response = await fetch(`/api/library/diary?mediaId=${encodeURIComponent(mediaId)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw await failure(response, 'Failed to read diary')
  return (await response.json()) as DiaryConfig
}

export async function deleteDiaryLog(id: string): Promise<void> {
  const response = await fetch('/api/library/diary', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!response.ok) throw await failure(response, 'Failed to delete diary entry')
}

export async function saveRatingScale(ratingScale: RatingScale): Promise<void> {
  const response = await fetch('/api/library/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ratingScale }),
  })
  if (!response.ok) throw await failure(response, 'Failed to save preference')
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
  const response = await fetch(`/api/library/progress?mediaId=${encodeURIComponent(mediaId)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw await failure(response, 'Failed to read progress')
  return (await response.json()) as ProgressConfig
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

/** «Marcar siguiente» (episodio, capítulo, páginas, %, hora). */
export async function advanceProgress(mediaId: string): Promise<AdvanceResult> {
  const response = await fetch('/api/library/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId, action: 'next' }),
  })
  if (!response.ok) throw await failure(response, 'Failed to save progress')
  return (await response.json()) as AdvanceResult
}

/** Pasa a «Completado» (y, si se pide y el diario está activo, lo apunta). */
export async function completeFromProgress(
  mediaId: string,
  options: { log: boolean; watchedOn?: string }
): Promise<{ log: DiaryLog | null; logFailed: boolean }> {
  const response = await fetch('/api/library/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId, action: 'complete', log: options.log, watchedOn: options.watchedOn }),
  })
  if (!response.ok) throw await failure(response, 'Failed to save library entry')
  const data = (await response.json()) as { log?: DiaryLog | null; logFailed?: boolean }
  return { log: data.log ?? null, logFailed: data.logFailed === true }
}
