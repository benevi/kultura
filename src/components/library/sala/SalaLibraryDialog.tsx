'use client'

// ============================================================
// KULTURA — SalaLibraryDialog (fase 8.5, ficha con `SALA_FICHA`)
// El diálogo de biblioteca en «Sala»: lo mismo que `LibraryStatusModal`
// (estado, nota, favorito, fecha, progreso por formato, apunte del diario y
// apuntes anteriores) con los componentes de `components/sala`. El estado y
// lo que se guarda salen de `useLibraryStatusForm`: un solo sitio decide.
//
// Hoja en móvil, diálogo centrado en escritorio (`SalaDialog`). El foco entra
// en «Estado» (`data-autofocus`); Escape y «Cancelar» cierran salvo mientras
// guarda. El error al guardar va dentro (`error`), anunciado. Va con la
// paleta de la obra (`palette`): el diálogo cuelga de `<body>`, fuera del
// contenedor `sala-work`.
// ============================================================

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SalaDialog } from '@/components/sala/SalaDialog'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaSelect } from '@/components/sala/SalaSelect'
import { SalaCheckbox } from '@/components/sala/SalaCheckbox'
import { SalaInput } from '@/components/sala/SalaInput'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { ProgressInput } from '@/components/library/ProgressInput'
import { SalaRatingInput } from '@/components/library/sala/SalaRatingInput'
import {
  LIBRARY_STATUSES,
  useLibraryStatusForm,
  type LibraryStatusSaveData,
} from '@/components/library/useLibraryStatusForm'
import { formatRating } from '@/lib/library/rating'
import { formatDiaryDate, localDateString } from '@/lib/library/dates'
import { PRIVATE_NOTE_MAX, REVIEW_MAX } from '@/lib/library/diary'
import type { ProgressConfig } from '@/lib/library/actions'
import type { ImagePalette } from '@/lib/design/image-palette'
import type { DiaryConfig, LibraryEntry, LibraryStatus } from '@/types/library'

interface SalaLibraryDialogProps {
  open: boolean
  current: LibraryEntry | null
  mediaType: string
  onSave: (data: LibraryStatusSaveData) => Promise<void>
  onClose: () => void
  loading: boolean
  /** Dónde vuelve el foco si el botón que lo abrió ya no existe al cerrar. */
  finalFocusRef?: RefObject<HTMLElement | null>
  error?: string | null
  diary?: DiaryConfig | null
  onDeleteLog?: (id: string) => Promise<void>
  /** Título de la obra: nombra los botones de borrar apunte. */
  title?: string
  progressConfig?: ProgressConfig | null
  /** Paleta de la obra (si ya llegó): el diálogo la lleva consigo. */
  palette?: ImagePalette
}

export function SalaLibraryDialog({ open, ...props }: SalaLibraryDialogProps) {
  // El formulario nace con cada apertura: parte siempre de la entrada guardada.
  if (!open) return null
  return <SalaLibraryDialogOpen {...props} />
}

function SalaLibraryDialogOpen({
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
  palette,
}: Omit<SalaLibraryDialogProps, 'open'>) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const tp = useTranslations('progress')
  const tc = useTranslations('common')
  const locale = useLocale()
  const formId = useId()
  const scoreLabelId = useId()
  const logsId = useId()

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
    dateError,
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

  const counter = (count: number, max: number) => td('chars', { count, max })

  // Cuando el control pulsado desaparece, el foco va a un sitio con sentido
  // (WCAG 2.4.3), nunca a <body>.
  const statusRef = useRef<HTMLSelectElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const logsHeadingRef = useRef<HTMLHeadingElement>(null)
  const logsListRef = useRef<HTMLUListElement>(null)
  const [announce, setAnnounce] = useState('')
  const [focusLogAt, setFocusLogAt] = useState<number | null>(null)

  // Fecha futura: el error lo dice el campo y el foco va a él.
  useEffect(() => {
    if (dateError) dateRef.current?.focus()
  }, [dateError])

  // Tras borrar un apunte: al siguiente (o al anterior si era el último) o,
  // si no queda ninguno, al encabezado de la sección.
  useEffect(() => {
    if (focusLogAt === null) return
    const buttons = logsListRef.current?.querySelectorAll<HTMLButtonElement>('[data-delete-log]')
    if (buttons && buttons.length > 0) buttons[Math.min(focusLogAt, buttons.length - 1)].focus()
    else (logsHeadingRef.current ?? statusRef.current)?.focus()
    setFocusLogAt(null)
  }, [logs.length, focusLogAt])

  async function deleteLog(id: string, index: number) {
    // Si falló, el apunte sigue y el foco se queda en su botón.
    if (await handleDelete(id)) setFocusLogAt(index)
  }

  function markCompleted() {
    changeStatus('completed')
    setAnnounce(tp('markedCompleted'))
    // El aviso con el botón desaparece: el foco va a «Estado», que ya dice «Completado».
    requestAnimationFrame(() => statusRef.current?.focus())
  }

  return (
    <SalaDialog
      open
      onClose={onClose}
      variant="sheet"
      title={current ? t('updateEntry') : t('addToLibrary')}
      description={title || undefined}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
      palette={palette}
      closeLabel={tc('close')}
      footer={
        <>
          <SalaButton type="submit" form={formId} variant="primary" loading={loading} loadingLabel={t('saving')}>
            {t('saveStatus')}
          </SalaButton>
          <SalaButton type="button" variant="quiet" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </SalaButton>
        </>
      }
    >
      {/* `noValidate`: los errores los dicen los campos, no el globo del navegador. */}
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6" data-testid="sala-library-form">
        <p role="status" className="sr-only">
          {announce}
        </p>
        {/* Estado: primer control, recibe el foco al abrir. */}
        <SalaSelect
          ref={statusRef}
          label={t('statusLabel')}
          value={status}
          onChange={(e) => changeStatus(e.target.value as LibraryStatus)}
          data-autofocus
        >
          {LIBRARY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </SalaSelect>

        {/* Puntuación (en la escala de cada persona) */}
        <div className="flex flex-col gap-1">
          <span id={scoreLabelId} className="sala-type-label text-sala-ink">
            {t('score')}
          </span>
          <SalaRatingInput mode={mode} rating10={rating10} onChange={changeRating} labelId={scoreLabelId} />
        </div>

        {diaryOn && (
          <SalaCheckbox label={td('favorite')} checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        )}

        {/* Fecha — solo cuando está completado */}
        {status === 'completed' && (
          <SalaInput
            ref={dateRef}
            type="date"
            error={dateError ?? undefined}
            label={t('watchedAt')}
            value={watchedAt}
            max={localDateString()}
            onChange={(e) => setWatchedAt(e.target.value)}
            fieldClassName="max-w-[16rem]"
          />
        )}

        {/* Progreso por formato (F-27): la misma lógica, pintado en «Sala». */}
        {showProgress && (
          <div className="flex flex-col gap-3">
            <ProgressInput
              mediaType={mediaType}
              value={progress}
              onChange={setProgress}
              total={progressTotal}
              referenceHours={mediaType === 'game' ? (plan?.total ?? null) : null}
              variant="sala"
            />
            {showNext && next && (
              <p className="sala-type-small text-sala-ink-secondary" data-testid="progress-next-episode">
                {next.name
                  ? tp('nextEpisodeNamed', { season: next.season, episode: next.episode, name: next.name })
                  : tp('nextEpisode', { season: next.season, episode: next.episode })}
              </p>
            )}
            {/* Región montada siempre: el aviso de «has llegado al final» se anuncia al aparecer. */}
            <div role="status">
              {reachedEnd && (
                <SalaNotice
                  live="off"
                  action={
                    <SalaButton type="button" variant="secondary" onClick={markCompleted}>
                      {tp('markCompleted')}
                    </SalaButton>
                  }
                >
                  {tp('reachedEnd', { type: mediaType })}
                </SalaNotice>
              )}
            </div>
          </div>
        )}

        {/* Diario (F-24) */}
        {showDiary && (
          <fieldset className="flex flex-col gap-4 border-t-2 border-sala-border pt-5">
            <legend className="sr-only">{td('title')}</legend>
            <SalaCheckbox
              label={td('addToDiary')}
              hint={td('addToDiaryHint')}
              checked={addToDiary}
              onChange={(e) => setAddToDiary(e.target.checked)}
            />

            {addToDiary && (
              <>
                <SalaCheckbox
                  label={td('rewatch', { type: mediaType })}
                  checked={rewatch}
                  onChange={(e) => changeRewatch(e.target.checked)}
                />
                <SalaTextarea
                  label={td('review')}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder={td('reviewPlaceholder')}
                  rows={3}
                  maxLength={REVIEW_MAX}
                  counter={counter}
                />
                <SalaCheckbox
                  label={td('spoiler')}
                  hint={review.trim() === '' ? td('spoilerHint') : undefined}
                  checked={spoiler && review.trim() !== ''}
                  disabled={review.trim() === ''}
                  onChange={(e) => setSpoiler(e.target.checked)}
                />
                <SalaTextarea
                  label={td('privateNote')}
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  placeholder={td('privateNotePlaceholder')}
                  rows={2}
                  maxLength={PRIVATE_NOTE_MAX}
                  counter={counter}
                />
              </>
            )}
          </fieldset>
        )}

        {/* Apuntes anteriores de este título */}
        {diaryOn && logs.length > 0 && (
          <section aria-labelledby={logsId} className="flex flex-col gap-3">
            <h3 id={logsId} ref={logsHeadingRef} tabIndex={-1} className="sala-type-label text-sala-ink focus:outline-none sala-focused:sala-focus">
              {td('previousLogs', { count: logs.length })}
            </h3>
            <ul ref={logsListRef} className="flex flex-col gap-2">
              {logs.map((log, index) => {
                const date = formatDiaryDate(log.watchedOn, locale)
                return (
                  <li key={log.id} className="flex items-start gap-3 bg-sala-panel px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="sala-type-text text-sala-ink">
                        {date}
                        {log.rewatch ? (
                          <span className="sala-type-small ml-2 text-sala-ink-secondary">· {td('rewatchShort', { type: mediaType })}</span>
                        ) : null}
                        {log.rating10 !== null ? (
                          <span className="sala-type-small ml-2 text-sala-ink">
                            · {formatRating(log.rating10, mode === 'ten' ? 'ten' : 'stars', locale)}
                          </span>
                        ) : null}
                      </span>
                      {log.review ? (
                        <span className="line-clamp-2 sala-type-small text-sala-ink-secondary">
                          {log.spoiler ? td('spoilerHidden') : log.review}
                        </span>
                      ) : null}
                    </div>
                    {onDeleteLog && (
                      <SalaButton
                        type="button"
                        variant="quiet"
                        onClick={() => void deleteLog(log.id, index)}
                        data-delete-log=""
                        loading={deleting === log.id}
                        loadingLabel={td('delete')}
                        disabled={deleting !== null}
                        aria-label={td('deleteLog', { title, date })}
                      >
                        {td('delete')}
                      </SalaButton>
                    )}
                  </li>
                )
              })}
            </ul>
            <div role="alert">
              {deleteError && (
                <SalaNotice tone="error" live="off">
                  {deleteError}
                </SalaNotice>
              )}
            </div>
          </section>
        )}
      </form>
    </SalaDialog>
  )
}
