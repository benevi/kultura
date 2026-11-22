'use client'

// ============================================================
// KULTURA — useLibraryStatusForm
// El estado y el envío del diálogo de biblioteca, sin vista: lo usan
// `LibraryStatusModal` (la ficha de hoy) y `SalaLibraryDialog` («Sala»,
// fase 8.5). Un solo sitio decide qué se guarda.
//
// F-24 (D-14): con el diario cargado, la nota va en la escala de la persona
// (½★ o /10), hay favorito y, al marcarlo como completado, un apunte del
// diario con fecha, revisionado, reseña (con aviso de spoiler) y nota
// personal. Sin el diario, lo de siempre (estrellas enteras).
//
// F-27 (PRO-5): el progreso va por formato. Al llegar al final se propone
// pasar a «Completado» (y con ello sale el apunte del diario).
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RatingMode } from '@/components/library/RatingInput'
import { rating10ToScore, storedRating10 } from '@/lib/library/rating'
import { localDateString } from '@/lib/library/dates'
import {
  isAtEnd,
  progressFromJson,
  progressKindFor,
  progressToLegacy,
  totalFor,
  type LibraryEntryWithProgress,
  type ProgressValue,
} from '@/lib/library/progress'
import type { ProgressConfig } from '@/lib/library/actions'
import type {
  DiaryConfig,
  DiaryLogInput,
  LibraryEntry,
  LibraryStatus,
  EpisodeProgress as EpisodeProgressType,
} from '@/types/library'

export interface LibraryStatusSaveData {
  status: LibraryStatus
  /** Nota entera 1-5 (derivada de rating10). */
  score: number | null
  /** Nota fina 0,5-10; la de antes si no se ha tocado (no se pierde precisión). */
  rating10: number | null
  /** Solo con el diario activo. */
  favorite?: boolean
  watchedAt: string | null
  episodeProgress: EpisodeProgressType | null
  /** Progreso por formato (F-27); ausente en formatos sin progreso. */
  progress?: ProgressValue | null
  /** Apunte del diario a crear (solo con el diario activo). */
  log?: DiaryLogInput
}

export const LIBRARY_STATUSES: LibraryStatus[] = ['completed', 'in_progress', 'pending', 'abandoned']

interface UseLibraryStatusFormOptions {
  current: LibraryEntry | null
  mediaType: string
  onSave: (data: LibraryStatusSaveData) => Promise<void>
  diary?: DiaryConfig | null
  onDeleteLog?: (id: string) => Promise<void>
  progressConfig?: ProgressConfig | null
}

export function useLibraryStatusForm({
  current,
  mediaType,
  onSave,
  diary = null,
  onDeleteLog,
  progressConfig = null,
}: UseLibraryStatusFormOptions) {
  const td = useTranslations('diary')

  const diaryOn = diary?.enabled === true
  const mode: RatingMode = diaryOn ? diary!.scale : 'legacy'
  const wasCompleted = current?.status === 'completed'

  const [status, setStatus] = useState<LibraryStatus>(current?.status ?? 'pending')
  const initialRating = current ? storedRating10(current.rating10) : null
  const [rating10, setRating10] = useState<number | null>(initialRating)
  const [ratingDirty, setRatingDirty] = useState(false)
  const [favorite, setFavorite] = useState<boolean>(current?.favorite ?? false)
  const [watchedAt, setWatchedAt] = useState<string>(current?.watchedAt ?? '')
  const [progress, setProgress] = useState<ProgressValue | null>(
    (current as LibraryEntryWithProgress | null)?.progress ?? progressFromJson(current?.episodeProgress ?? null)
  )
  // Diario: se propone apuntar al marcarlo como completado por primera vez;
  // al editar algo que ya estaba completado, no (no duplicar apuntes).
  const [addToDiary, setAddToDiary] = useState(false)
  const [rewatchTouched, setRewatchTouched] = useState(false)
  const [rewatchValue, setRewatchValue] = useState(false)
  const [review, setReview] = useState('')
  const [spoiler, setSpoiler] = useState(false)
  const [privateNote, setPrivateNote] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const logs = diary?.logs ?? []
  const rewatch = rewatchTouched ? rewatchValue : wasCompleted || logs.length > 0

  // F-27: progreso en todos los formatos.
  const showProgress = progressKindFor(mediaType) !== null
  const plan = progressConfig?.plan ?? null
  const progressTotal = totalFor(mediaType, progress, plan) ?? progress?.total ?? null
  const reachedEnd = showProgress && status !== 'completed' && isAtEnd(mediaType, progress, plan)
  const next = progressConfig?.next ?? null
  const showNext =
    next !== null &&
    JSON.stringify(progress ?? null) === JSON.stringify(progressConfig?.progress ?? null)
  const showDiary = diaryOn && status === 'completed'

  function changeStatus(next: LibraryStatus) {
    setStatus(next)
    if (next === 'completed' && !wasCompleted) setAddToDiary(true)
  }

  function changeRating(next: number | null) {
    setRating10(next)
    setRatingDirty(true)
  }

  function changeRewatch(value: boolean) {
    setRewatchTouched(true)
    setRewatchValue(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalRating = ratingDirty ? rating10 : initialRating
    const completedOn = status === 'completed' && watchedAt ? watchedAt : null
    // El total del proveedor viaja con el progreso (para la barra de Inicio).
    const savedProgress = progress && progressTotal !== null ? { ...progress, total: progressTotal } : progress
    await onSave({
      status,
      score: rating10ToScore(finalRating),
      rating10: finalRating,
      ...(diaryOn ? { favorite } : {}),
      watchedAt: completedOn,
      episodeProgress: showProgress ? progressToLegacy(savedProgress) : null,
      // Siempre que el formato tenga progreso, aunque el control aún no se
      // vea (configuración sin cargar): guardar = sustituir, y así no se
      // pierden las páginas u horas que ya había.
      ...(progressKindFor(mediaType) !== null ? { progress: savedProgress } : {}),
      ...(showDiary && addToDiary
        ? {
            log: {
              watchedOn: completedOn ?? localDateString(),
              rewatch,
              review: review.trim() || undefined,
              spoiler: review.trim() !== '' && spoiler,
              privateNote: privateNote.trim() || undefined,
            },
          }
        : {}),
    })
  }

  async function handleDelete(id: string) {
    if (!onDeleteLog) return
    setDeleting(id)
    setDeleteError(null)
    try {
      await onDeleteLog(id)
    } catch {
      setDeleteError(td('deleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  return {
    diaryOn,
    mode,
    status,
    changeStatus,
    rating10,
    changeRating,
    favorite,
    setFavorite,
    watchedAt,
    setWatchedAt,
    progress,
    setProgress,
    addToDiary,
    setAddToDiary,
    rewatch,
    changeRewatch,
    review,
    setReview,
    spoiler,
    setSpoiler,
    privateNote,
    setPrivateNote,
    deleting,
    deleteError,
    logs,
    showProgress,
    plan,
    progressTotal,
    reachedEnd,
    next,
    showNext,
    showDiary,
    handleSubmit,
    handleDelete,
  }
}
