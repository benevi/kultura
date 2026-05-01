// ============================================================
// KULTURA — Tipos de Biblioteca Personal
// Define los tipos para la biblioteca personal del usuario:
// estados, progreso de episodios, entradas y payloads.
// ============================================================

/** Estados posibles de un título en la biblioteca personal */
export type LibraryStatus = 'completed' | 'in_progress' | 'pending' | 'abandoned'

/** Guard para verificar que un valor es un LibraryStatus válido */
export function isLibraryStatus(value: string): value is LibraryStatus {
  return ['completed', 'in_progress', 'pending', 'abandoned'].includes(value)
}

/** Progreso de episodios para series y anime */
export interface EpisodeProgress {
  season?: number
  episode: number
}

/** Entrada de la biblioteca personal del usuario (mapeada desde user_media) */
export interface LibraryEntry {
  id: string
  userId: string
  mediaId: string
  status: LibraryStatus
  score: number | null
  watchedAt: string | null
  episodeProgress: EpisodeProgress | null
  createdAt: string
  /** Campos de visualización, poblados cuando se hace JOIN con la tabla media */
  title?: string
  poster?: string
  year?: number
}

/** Payload para añadir o actualizar una entrada en la biblioteca */
export interface LibraryPayload {
  mediaId: string
  status: LibraryStatus
  score?: number
  watchedAt?: string
  episodeProgress?: EpisodeProgress
  /** Datos del MediaItem para cachear en tabla media si no existe */
  mediaCache?: {
    externalId: string
    type: string
    title: string
    poster?: string
    backdrop?: string
    year?: number
    synopsis?: string
  }
}
