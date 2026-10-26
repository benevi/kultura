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
// `type` y no `interface`: así se asigna a la columna jsonb (`Json`) del cliente tipado.
export type EpisodeProgress = {
  season?: number
  episode: number
}

/**
 * Cómo ve y pone sus notas cada persona (F-24, D-14): medias estrellas sobre
 * 5 (`stars`) o sobre 10 en pasos de 0,5 (`ten`). Se guarda igual en los dos
 * casos: `rating10` de 0,5 a 10.
 */
export type RatingScale = 'stars' | 'ten'

export function isRatingScale(value: unknown): value is RatingScale {
  return value === 'stars' || value === 'ten'
}

/** Entrada de la biblioteca personal del usuario (mapeada desde user_media) */
export interface LibraryEntry {
  id: string
  userId: string
  mediaId: string
  status: LibraryStatus
  /** Nota entera 1-5 (la de siempre; con la migración la deriva rating10). */
  score: number | null
  /** Nota fina 0,5-10 en pasos de 0,5 (F-24). Sin la migración, score × 2. */
  rating10?: number | null
  /** Favorito (F-24). Sin la migración, false. */
  favorite?: boolean
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
  /** Nota entera 1-5. Si llega `rating10`, manda `rating10`. */
  score?: number
  /** Nota fina 0,5-10 (pasos de 0,5); `null` la quita. Solo con RATING_SCALE_10. */
  rating10?: number | null
  favorite?: boolean
  /** Apunte del diario que se crea junto con la entrada (solo con RATING_SCALE_10). */
  log?: DiaryLogInput
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
    /** Géneros del item — se cachean en media.metadata.genres, fuente real del
     * perfil de gustos de match-score.ts. Sin esto, computeMatchScores nunca
     * tiene señal de género (bug real detectado en producción: 0% MATCH). */
    genres?: string[]
  }
}

/** Apunte del diario: un visionado, lectura o partida con fecha (user_media_logs). */
export interface DiaryLog {
  id: string
  mediaId: string
  /** AAAA-MM-DD */
  watchedOn: string
  rewatch: boolean
  rating10: number | null
  review: string | null
  spoiler: boolean
  /** Nota personal: solo la ve su dueño. */
  privateNote: string | null
  createdAt: string
  /** Campos de visualización (JOIN con media) */
  title?: string
  poster?: string
  year?: number
}

/** Lo que manda el cliente para apuntar en el diario. */
export interface DiaryLogInput {
  watchedOn?: string
  rewatch?: boolean
  /** Si no llega, la nota de la entrada. */
  rating10?: number | null
  review?: string
  spoiler?: boolean
  privateNote?: string
}

/** Respuesta de GET /api/library/diary. */
export interface DiaryConfig {
  /** RATING_SCALE_10=1 y la migración aplicada. */
  enabled: boolean
  scale: RatingScale
  logs: DiaryLog[]
}
