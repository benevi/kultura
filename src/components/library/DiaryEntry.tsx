'use client'

// ============================================================
// KULTURA — Un apunte del diario (F-24)
// Fecha, nota en la escala de la persona, revisionado, reseña (con spoilers,
// oculta hasta pulsar) y nota personal. Lo usan el diario de la Biblioteca
// (con el cromo pequeño y el título) y la ficha (solo el apunte: el título ya
// está arriba). Borrar no es inmediato: lo decide quien lo pinta (aviso con
// «Deshacer», `useUndoableLogDelete`).
// ============================================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { Cromo } from '@/components/album/Cromo'
import { formatDiaryDate } from '@/lib/library/dates'
import { cn } from '@/lib/utils/index'
import type { DiaryLog } from '@/types/library'
import { ratingParts, type DisplayScale } from './rating-display'

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function splitMediaId(mediaId: string): { type: string; externalId: string } {
  const i = mediaId.indexOf('_')
  return { type: mediaId.slice(0, i), externalId: mediaId.slice(i + 1) }
}

interface DiaryEntryProps {
  log: DiaryLog
  scale: DisplayScale
  /** Con el cromo pequeño y el título enlazado a su ficha (diario de la Biblioteca). */
  showTitle?: boolean
  /** Nombre de la obra para los textos del lector y del aviso. */
  title: string
  onDelete?: (log: DiaryLog) => void
  className?: string
}

export function DiaryEntry({ log, scale, showTitle = false, title, onDelete, className }: DiaryEntryProps) {
  const t = useTranslations('diary')
  const locale = useLocale()
  const [revealed, setRevealed] = useState(false)
  const { type, externalId } = splitMediaId(log.mediaId)
  const date = formatDiaryDate(log.watchedOn, locale)
  const rating = ratingParts(log.rating10, scale, locale)
  const hidden = log.spoiler && !revealed
  const reviewId = `diary-review-${log.id}`

  return (
    <li className={cn('flex gap-3 rounded-bento bg-surface-default p-3', className)}>
      {showTitle ? (
        <Link href={`/media/${type}/${externalId}`} tabIndex={-1} aria-hidden="true" className="group w-14 shrink-0 self-start">
          <Cromo title={title} seed={log.mediaId} poster={log.poster} sizes="56px" />
        </Link>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {showTitle ? (
            <Link
              href={`/media/${type}/${externalId}`}
              className={cn('min-w-0 break-words rounded-lg font-body font-semibold text-text-primary hover:underline', FOCUS)}
            >
              {title}
              {log.year ? <span className="ml-1 font-normal tabular-nums text-text-tertiary">({log.year})</span> : null}
            </Link>
          ) : (
            <time dateTime={log.watchedOn} className="font-body text-sm font-semibold text-text-primary">
              {date}
            </time>
          )}
          {rating ? (
            <span className="text-sm font-semibold tabular-nums text-text-primary">
              {t('ratingOf', { value: rating.value, max: rating.max })}
            </span>
          ) : null}
        </div>
        {showTitle || log.rewatch ? (
          <p className="text-xs text-text-tertiary">
            {showTitle ? <time dateTime={log.watchedOn}>{date}</time> : null}
            {showTitle && log.rewatch ? ' · ' : null}
            {log.rewatch ? t('rewatchShort', { type }) : null}
          </p>
        ) : null}
        {log.review ? (
          <div className="flex flex-col items-start gap-1">
            {hidden ? (
              <p className="text-sm italic text-text-secondary">{t('spoilerHidden')}</p>
            ) : (
              <p id={reviewId} className="whitespace-pre-line break-words text-sm text-text-secondary">
                {log.review}
              </p>
            )}
            {log.spoiler ? (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-expanded={!hidden}
                aria-controls={hidden ? undefined : reviewId}
                className={cn('min-h-11 rounded-lg text-xs font-semibold text-accent-info underline-offset-2 hover:underline', FOCUS)}
              >
                {hidden ? t('showSpoiler') : t('hideSpoiler')}
              </button>
            ) : null}
          </div>
        ) : null}
        {log.privateNote ? (
          <p className="break-words text-xs text-text-tertiary">
            <span className="font-semibold">{t('privateNote')}:</span> {log.privateNote}
          </p>
        ) : null}
      </div>
      {onDelete ? (
        <div className="shrink-0 self-start">
          <KButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onDelete(log)}
            aria-label={t('deleteLog', { title, date })}
          >
            {t('delete')}
          </KButton>
        </div>
      ) : null}
    </li>
  )
}
