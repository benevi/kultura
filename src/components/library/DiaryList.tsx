'use client'

// ============================================================
// KULTURA — DiaryList (F-24)
// El diario de la persona en su Biblioteca: apuntes agrupados por mes, del
// más reciente al más antiguo, con fecha, nota en su escala, revisionado y
// reseña (las que tienen spoilers, ocultas hasta pulsar). Solo lo ve su dueño.
// ============================================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { PosterImage } from '@/components/media/PosterImage'
import { useToastContext } from '@/components/ui/ToastProvider'
import { posterGradient } from '@/lib/images/poster-gradient'
import { deleteDiaryLog } from '@/lib/library/actions'
import { formatDiaryDate, formatDiaryMonth } from '@/lib/library/dates'
import { formatRating } from '@/lib/library/rating'
import type { DiaryLog, RatingScale } from '@/types/library'

interface DiaryListProps {
  logs: DiaryLog[]
  scale: RatingScale
}

function splitMediaId(mediaId: string): { type: string; externalId: string } {
  const i = mediaId.indexOf('_')
  return { type: mediaId.slice(0, i), externalId: mediaId.slice(i + 1) }
}

/** Agrupa por AAAA-MM conservando el orden (ya viene de más reciente a más antiguo). */
function byMonth(logs: DiaryLog[]): Array<{ month: string; logs: DiaryLog[] }> {
  const groups: Array<{ month: string; logs: DiaryLog[] }> = []
  for (const log of logs) {
    const month = log.watchedOn.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.logs.push(log)
    else groups.push({ month, logs: [log] })
  }
  return groups
}

export function DiaryList({ logs: initialLogs, scale }: DiaryListProps) {
  const t = useTranslations('diary')
  const locale = useLocale()
  const { show, showError } = useToastContext()
  const [logs, setLogs] = useState(initialLogs)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)

  async function remove(log: DiaryLog) {
    setDeleting(log.id)
    try {
      await deleteDiaryLog(log.id)
      setLogs((prev) => prev.filter((l) => l.id !== log.id))
      show({ message: t('deleted', { title: log.title ?? log.mediaId }), type: 'success' })
    } catch {
      showError(t('deleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  function toggleSpoiler(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
        <h2 className="font-display text-xl font-semibold text-text-primary">{t('emptyTitle')}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t('emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8" aria-label={t('listLabel')} role="region">
      {byMonth(logs).map((group) => (
        <section key={group.month} aria-labelledby={`diary-${group.month}`} className="flex flex-col gap-3">
          <h2
            id={`diary-${group.month}`}
            className="font-display text-lg font-bold capitalize text-text-primary"
          >
            {formatDiaryMonth(group.month, locale)}
          </h2>
          <ul className="flex flex-col gap-3">
            {group.logs.map((log) => {
              const { type, externalId } = splitMediaId(log.mediaId)
              const date = formatDiaryDate(log.watchedOn, locale)
              const title = log.title ?? log.mediaId
              const isHidden = log.spoiler && !revealed.has(log.id)
              const reviewId = `diary-review-${log.id}`
              return (
                <li key={log.id} className="flex gap-4 rounded-bento bg-surface-default p-3">
                  {/* Portada con tamaño fijo y gradiente detrás (CLS 0). */}
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
                    <div aria-hidden="true" className="absolute inset-0" style={{ background: posterGradient(log.mediaId) }} />
                    {log.poster ? <PosterImage src={log.poster} sizes="64px" className="object-cover" /> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/media/${type}/${externalId}`}
                        className="font-body font-semibold text-text-primary hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-focus-ring rounded-lg"
                      >
                        {title}
                        {log.year ? <span className="ml-1 font-normal text-text-tertiary">({log.year})</span> : null}
                      </Link>
                      {log.rating10 !== null ? (
                        <span className="text-sm font-semibold text-accent-highlight tabular-nums">
                          {formatRating(log.rating10, scale, locale)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-text-tertiary">
                      <time dateTime={log.watchedOn}>{date}</time>
                      {log.rewatch ? <> · {t('rewatchShort', { type })}</> : null}
                    </p>
                    {log.review ? (
                      <div className="flex flex-col items-start gap-1">
                        {isHidden ? (
                          <p className="text-sm italic text-text-secondary">{t('spoilerHidden')}</p>
                        ) : (
                          <p id={reviewId} className="whitespace-pre-line text-sm text-text-secondary">
                            {log.review}
                          </p>
                        )}
                        {log.spoiler ? (
                          <button
                            type="button"
                            onClick={() => toggleSpoiler(log.id)}
                            aria-expanded={!isHidden}
                            aria-controls={isHidden ? undefined : reviewId}
                            className="min-h-11 text-xs font-semibold text-accent-info underline-offset-2 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-focus-ring rounded-lg"
                          >
                            {isHidden ? t('showSpoiler') : t('hideSpoiler')}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {log.privateNote ? (
                      <p className="text-xs text-text-tertiary">
                        <span className="font-semibold">{t('privateNote')}:</span> {log.privateNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 self-start">
                    <KButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(log)}
                      loading={deleting === log.id}
                      disabled={deleting !== null}
                      aria-label={t('deleteLog', { title, date })}
                    >
                      {t('delete')}
                    </KButton>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
