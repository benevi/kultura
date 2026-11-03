'use client'

// ============================================================
// KULTURA — DiaryList (F-24)
// El diario de la persona en su Biblioteca: apuntes agrupados por mes, del
// más reciente al más antiguo, con su cromo pequeño, fecha, nota en su
// escala, revisionado y reseña (las que tienen spoilers, ocultas hasta
// pulsar). Solo lo ve su dueño. Borrar un apunte se puede deshacer mientras
// dura el aviso (`useUndoableLogDelete`).
// ============================================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDiaryMonth } from '@/lib/library/dates'
import type { DiaryLog, RatingScale } from '@/types/library'
import { DiaryEntry } from './DiaryEntry'
import { useUndoableLogDelete } from './useUndoableLogDelete'

interface DiaryListProps {
  logs: DiaryLog[]
  scale: RatingScale
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
  const [logs, setLogs] = useState(initialLogs)
  const remove = useUndoableLogDelete(setLogs)

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 py-12">
        <h2 className="font-display text-2xl text-text-primary">{t('emptyTitle')}</h2>
        <p className="max-w-prose text-sm leading-relaxed text-text-secondary">{t('emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8" aria-label={t('listLabel')} role="region">
      {byMonth(logs).map((group) => (
        <section key={group.month} aria-labelledby={`diary-${group.month}`} className="flex flex-col gap-3">
          <h2 id={`diary-${group.month}`} className="font-display text-2xl capitalize text-text-primary">
            {formatDiaryMonth(group.month, locale)}
          </h2>
          <ul className="flex max-w-3xl flex-col gap-3">
            {group.logs.map((log) => {
              const title = log.title ?? t('untitled')
              return (
                <DiaryEntry
                  key={log.id}
                  log={log}
                  scale={scale}
                  title={title}
                  showTitle
                  onDelete={(l) => remove(l, title)}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
