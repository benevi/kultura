'use client'

// ============================================================
// KULTURA — LibraryStatusModal
// Modal para añadir o actualizar un título en la biblioteca. Sobre `Modal`
// en variante hoja: en móvil sube desde abajo, cabe con el teclado abierto
// (scroll interno, 85dvh) y se cierra arrastrando el asa (MOV-8).
//
// F-24 (D-14): con el diario activo (RATING_SCALE_10 y la migración), la nota
// va en la escala de la persona (½★ o /10), hay favorito y, al marcarlo como
// completado, un apunte del diario con fecha, revisionado, reseña (con aviso
// de spoiler) y nota personal; debajo, los apuntes anteriores. Sin el diario,
// el diálogo es el de siempre (estrellas enteras).
//
// F-27 (PRO-5): el progreso va por formato (`ProgressInput`): episodios con
// el total de la temporada de TMDB, capítulos y volúmenes, páginas o %,
// horas. Al llegar al final se propone pasar a «Completado» (y con ello sale
// el apunte del diario). Sin PROGRESS_V2 o sin su migración, solo episodios
// en series y anime, como siempre.
// ============================================================

import { useId, useState, type RefObject } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { ProgressInput } from '@/components/library/ProgressInput'
import { RatingInput, type RatingMode } from '@/components/library/RatingInput'
import { Modal } from '@/components/ui/Modal'
import { entryRating10, formatRating, rating10ToScore } from '@/lib/library/rating'
import { formatDiaryDate, localDateString } from '@/lib/library/dates'
import { PRIVATE_NOTE_MAX, REVIEW_MAX } from '@/lib/library/diary'
import {
  isAtEnd,
  progressFromJson,
  progressKindFor,
  progressToLegacy,
  supportsLegacyProgress,
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

interface LibraryStatusModalProps {
  current: LibraryEntry | null
  mediaType: string
  onSave: (data: LibraryStatusSaveData) => Promise<void>
  onClose: () => void
  loading: boolean
  /** Dónde vuelve el foco si el botón que lo abrió ya no existe al cerrar. */
  finalFocusRef?: RefObject<HTMLElement | null>
  /** Error al guardar (502 del catálogo…): se anuncia dentro del diálogo. */
  error?: string | null
  /** Escala y diario (F-24). Sin él (o desactivado), el diálogo de siempre. */
  diary?: DiaryConfig | null
  /** Borra un apunte anterior; lanza si falla. */
  onDeleteLog?: (id: string) => Promise<void>
  /** Título de la obra: nombra los botones de borrar apunte. */
  title?: string
  /** Progreso por formato y plan del proveedor (F-27). Sin él, solo episodios. */
  progressConfig?: ProgressConfig | null
}

const TEXTAREA =
  'w-full bg-surface-elevated border border-field-border rounded-2xl px-[18px] py-3 font-body text-base md:text-body text-text-primary placeholder:text-text-tertiary resize-y focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
const CHECK_ROW = 'flex min-h-11 items-center gap-3 cursor-pointer rounded-2xl bg-surface-default px-3 py-2.5'
const CHECKBOX = 'accent-accent-positive w-5 h-5 flex-shrink-0'

export function LibraryStatusModal({
  current,
  mediaType,
  onSave,
  onClose,
  loading,
  finalFocusRef,
  error = null,
  diary = null,
  onDeleteLog,
  title = '',
  progressConfig = null,
}: LibraryStatusModalProps) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const tp = useTranslations('progress')
  const locale = useLocale()
  const scoreLabelId = useId()
  const reviewId = useId()
  const noteId = useId()
  const reviewCountId = useId()

  const diaryOn = diary?.enabled === true
  const mode: RatingMode = diaryOn ? diary!.scale : 'legacy'
  const wasCompleted = current?.status === 'completed'

  const [status, setStatus] = useState<LibraryStatus>(current?.status ?? 'pending')
  const initialRating = current ? entryRating10(current) : null
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

  // F-27: todos los formatos con PROGRESS_V2 y su migración; si no, episodios.
  const fullProgress = progressConfig?.enabled === true
  const showProgress = progressKindFor(mediaType) !== null && (fullProgress || supportsLegacyProgress(mediaType))
  const plan = progressConfig?.plan ?? null
  const progressTotal = totalFor(mediaType, progress, plan) ?? progress?.total ?? null
  const reachedEnd = showProgress && status !== 'completed' && isAtEnd(mediaType, progress, plan)
  const next = progressConfig?.next ?? null
  const showNext =
    next !== null &&
    JSON.stringify(progress ?? null) === JSON.stringify(progressConfig?.progress ?? null)
  const showDiary = diaryOn && status === 'completed'

  const statusOptions = [
    { value: 'completed', label: t('status.completed') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'pending', label: t('status.pending') },
    { value: 'abandoned', label: t('status.abandoned') },
  ]

  function changeStatus(next: LibraryStatus) {
    setStatus(next)
    if (next === 'completed' && !wasCompleted) setAddToDiary(true)
  }

  function changeRating(next: number | null) {
    setRating10(next)
    setRatingDirty(true)
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

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={current ? t('updateEntry') : t('addToLibrary')}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Estado: primer control, recibe el foco al abrir. */}
        <Select
          value={status}
          onChange={(val) => changeStatus(val as LibraryStatus)}
          options={statusOptions}
          label={t('statusLabel')}
          data-autofocus
        />

        {/* Puntuación (en la escala de cada persona) */}
        <div className="flex flex-col gap-1">
          <span id={scoreLabelId} className="text-sm font-body font-medium text-text-secondary">
            {t('score')}
          </span>
          <RatingInput mode={mode} rating10={rating10} onChange={changeRating} labelId={scoreLabelId} />
        </div>

        {diaryOn && (
          <label className={CHECK_ROW}>
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className={CHECKBOX}
            />
            <span className="text-sm font-medium text-text-primary">{td('favorite')}</span>
          </label>
        )}

        {/* Fecha — solo visible cuando status = 'completed' */}
        {status === 'completed' && (
          <KInput
            id="watched-at"
            type="date"
            label={t('watchedAt')}
            value={watchedAt}
            max={localDateString()}
            onChange={(e) => setWatchedAt(e.target.value)}
          />
        )}

        {/* Progreso por formato (F-27). Cada número con su etiqueta y −/+. */}
        {showProgress && (
          <div className="flex flex-col gap-2">
            <ProgressInput
              mediaType={mediaType}
              value={progress}
              onChange={setProgress}
              full={fullProgress}
              total={progressTotal}
              referenceHours={mediaType === 'game' ? (plan?.total ?? null) : null}
            />
            {showNext && next && (
              <p className="text-xs text-text-tertiary" data-testid="progress-next-episode">
                {next.name
                  ? tp('nextEpisodeNamed', { season: next.season, episode: next.episode, name: next.name })
                  : tp('nextEpisode', { season: next.season, episode: next.episode })}
              </p>
            )}
            {reachedEnd && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-default px-3 py-2.5"
              >
                <span className="text-sm font-medium text-text-primary">{tp('reachedEnd', { type: mediaType })}</span>
                <KButton type="button" variant="secondary" size="sm" onClick={() => changeStatus('completed')}>
                  {tp('markCompleted')}
                </KButton>
              </div>
            )}
          </div>
        )}

        {/* Diario (F-24) */}
        {showDiary && (
          <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
            <legend className="sr-only">{td('title')}</legend>
            <label className={CHECK_ROW}>
              <input
                type="checkbox"
                checked={addToDiary}
                onChange={(e) => setAddToDiary(e.target.checked)}
                className={CHECKBOX}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-text-primary">{td('addToDiary')}</span>
                <span className="text-xs text-text-tertiary">{td('addToDiaryHint')}</span>
              </span>
            </label>

            {addToDiary && (
              <>
                <label className={CHECK_ROW}>
                  <input
                    type="checkbox"
                    checked={rewatch}
                    onChange={(e) => {
                      setRewatchTouched(true)
                      setRewatchValue(e.target.checked)
                    }}
                    className={CHECKBOX}
                  />
                  <span className="text-sm font-medium text-text-primary">{td('rewatch', { type: mediaType })}</span>
                </label>

                <div className="flex flex-col gap-2">
                  <label htmlFor={reviewId} className="font-body text-meta font-bold text-text-tertiary">
                    {td('review')}
                  </label>
                  <textarea
                    id={reviewId}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder={td('reviewPlaceholder')}
                    rows={3}
                    maxLength={REVIEW_MAX}
                    aria-describedby={reviewCountId}
                    className={TEXTAREA}
                  />
                  <span id={reviewCountId} className="self-end text-xs text-text-tertiary tabular-nums">
                    {td('chars', { count: review.length, max: REVIEW_MAX })}
                  </span>
                </div>

                <label className={CHECK_ROW}>
                  <input
                    type="checkbox"
                    checked={spoiler && review.trim() !== ''}
                    disabled={review.trim() === ''}
                    onChange={(e) => setSpoiler(e.target.checked)}
                    className={CHECKBOX}
                  />
                  <span className="text-sm font-medium text-text-primary">{td('spoiler')}</span>
                </label>

                <div className="flex flex-col gap-2">
                  <label htmlFor={noteId} className="font-body text-meta font-bold text-text-tertiary">
                    {td('privateNote')}
                  </label>
                  <textarea
                    id={noteId}
                    value={privateNote}
                    onChange={(e) => setPrivateNote(e.target.value)}
                    placeholder={td('privateNotePlaceholder')}
                    rows={2}
                    maxLength={PRIVATE_NOTE_MAX}
                    className={TEXTAREA}
                  />
                </div>
              </>
            )}
          </fieldset>
        )}

        {/* Apuntes anteriores de este título */}
        {diaryOn && logs.length > 0 && (
          <section aria-labelledby={`${scoreLabelId}-logs`} className="flex flex-col gap-2">
            <h3 id={`${scoreLabelId}-logs`} className="text-sm font-body font-semibold text-text-secondary">
              {td('previousLogs', { count: logs.length })}
            </h3>
            <ul className="flex flex-col gap-2">
              {logs.map((log) => {
                const date = formatDiaryDate(log.watchedOn, locale)
                return (
                  <li key={log.id} className="flex items-start gap-3 rounded-2xl bg-surface-default px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium text-text-primary">
                        {date}
                        {log.rewatch ? <span className="ml-2 text-xs text-text-tertiary">· {td('rewatchShort', { type: mediaType })}</span> : null}
                        {log.rating10 !== null ? (
                          <span className="ml-2 text-xs text-accent-highlight">{formatRating(log.rating10, mode === 'ten' ? 'ten' : 'stars', locale)}</span>
                        ) : null}
                      </span>
                      {log.review ? (
                        <span className="line-clamp-2 text-xs text-text-secondary">
                          {log.spoiler ? td('spoilerHidden') : log.review}
                        </span>
                      ) : null}
                    </div>
                    {onDeleteLog && (
                      <KButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDelete(log.id)}
                        loading={deleting === log.id}
                        disabled={deleting !== null}
                        aria-label={td('deleteLog', { title, date })}
                      >
                        {td('delete')}
                      </KButton>
                    )}
                  </li>
                )
              })}
            </ul>
            {deleteError && (
              <p role="alert" className="text-sm text-accent-danger">
                {deleteError}
              </p>
            )}
          </section>
        )}

        {/* Botones */}
        <div className="flex items-center gap-3 pt-2">
          <KButton
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
          >
            {loading ? t('saving') : t('saveStatus')}
          </KButton>
          <KButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('cancel')}
          </KButton>
        </div>
      </form>
    </Modal>
  )
}
