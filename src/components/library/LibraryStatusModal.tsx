'use client'

// ============================================================
// KULTURA — LibraryStatusModal
// Modal para añadir o actualizar un título en la biblioteca. Sobre `Modal`
// en variante hoja: en móvil sube desde abajo, cabe con el teclado abierto
// (scroll interno, 85dvh) y se cierra arrastrando el asa (MOV-8).
//
// F-24 (D-14): con el diario cargado, la nota
// va en la escala de la persona (½★ o /10), hay favorito y, al marcarlo como
// completado, un apunte del diario con fecha, revisionado, reseña (con aviso
// de spoiler) y nota personal; debajo, los apuntes anteriores. Sin el diario,
// el diálogo es el de siempre (estrellas enteras).
//
// F-27 (PRO-5): el progreso va por formato (`ProgressInput`): episodios con
// el total de la temporada de TMDB, capítulos y volúmenes, páginas o %,
// horas. Al llegar al final se propone pasar a «Completado» (y con ello sale
// el apunte del diario).
// ============================================================

import { useId, type RefObject } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { KTextarea } from '@/components/ui/KTextarea'
import { ProgressInput } from '@/components/library/ProgressInput'
import { RatingInput } from '@/components/library/RatingInput'
import { Modal } from '@/components/ui/Modal'
import { useLibraryStatusForm, type LibraryStatusSaveData } from '@/components/library/useLibraryStatusForm'
import { formatRating } from '@/lib/library/rating'
import { formatDiaryDate, localDateString } from '@/lib/library/dates'
import { PRIVATE_NOTE_MAX, REVIEW_MAX } from '@/lib/library/diary'
import type { ProgressConfig } from '@/lib/library/actions'
import type { DiaryConfig, LibraryEntry, LibraryStatus } from '@/types/library'

export type { LibraryStatusSaveData }

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

  const {
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
  } = useLibraryStatusForm({ current, mediaType, onSave, diary, onDeleteLog, progressConfig })

  const statusOptions = [
    { value: 'completed', label: t('status.completed') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'pending', label: t('status.pending') },
    { value: 'abandoned', label: t('status.abandoned') },
  ]

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
                    onChange={(e) => changeRewatch(e.target.checked)}
                    className={CHECKBOX}
                  />
                  <span className="text-sm font-medium text-text-primary">{td('rewatch', { type: mediaType })}</span>
                </label>

                <div className="flex flex-col gap-2">
                  <KTextarea
                    id={reviewId}
                    label={td('review')}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder={td('reviewPlaceholder')}
                    rows={3}
                    maxLength={REVIEW_MAX}
                    aria-describedby={reviewCountId}
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

                <KTextarea
                  id={noteId}
                  label={td('privateNote')}
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  placeholder={td('privateNotePlaceholder')}
                  rows={2}
                  maxLength={PRIVATE_NOTE_MAX}
                />
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
