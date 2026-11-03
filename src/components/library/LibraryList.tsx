'use client'

// ============================================================
// KULTURA — La Biblioteca en lista (para operar)
// La vista densa: una fila por título con su cromo pequeño, formato, año,
// estado, progreso, tu nota y cuándo lo tocaste. La ordenan, filtran y buscan
// los controles de `LibraryClient`. 60 filas y «Ver más» (WIG: nada de pintar
// cientos de golpe); las filas fuera de pantalla no se pintan.
// ============================================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Cromo } from '@/components/album/Cromo'
import { FormatTag } from '@/components/album/FormatTag'
import { useAlbumLabels } from '@/components/album/labels'
import { KButton } from '@/components/ui/KButton'
import { formatSince } from '@/lib/design/format'
import { hasProgress } from '@/lib/library/progress'
import { entryRating10 } from '@/lib/library/rating'
import { itemHref, parseMediaId, touchedTime, type LibraryItem } from './library-item'
import { ratingParts, type DisplayScale } from './rating-display'
import { useProgressLabel } from './useProgressLabel'

export const LIST_PAGE_SIZE = 60

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

interface LibraryListProps {
  items: LibraryItem[]
  scale: DisplayScale
}

export function LibraryList({ items, scale }: LibraryListProps) {
  const t = useTranslations('library')
  const labels = useAlbumLabels()
  const locale = useLocale()
  const progressLabel = useProgressLabel()
  const [shown, setShown] = useState(LIST_PAGE_SIZE)
  const visible = items.slice(0, shown)
  const rest = items.length - visible.length

  return (
    <div>
      <ul aria-label={t('list.label')} className="flex flex-col border-t-2 border-surface-border">
        {visible.map((item) => {
          const { type } = parseMediaId(item.mediaId)
          const title = item.title ?? t('untitled')
          const rating = ratingParts(entryRating10(item), scale, locale)
          const progress = item.status === 'in_progress' && hasProgress(item.progress) ? progressLabel(type, item.progress) : null
          const touched = new Date(touchedTime(item))
          return (
            <li
              key={item.id}
              data-list-row=""
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b-2 border-surface-border py-2.5 [contain-intrinsic-size:auto_4.5rem] [content-visibility:auto] md:grid-cols-[2.5rem_minmax(0,1fr)_10rem_6rem_7rem]"
            >
              <div className="w-10" aria-hidden="true">
                <Cromo title={title} seed={item.mediaId} poster={item.poster} sizes="40px" still />
              </div>
              <div className="min-w-0">
                <Link
                  href={itemHref(item)}
                  className={`line-clamp-2 break-words rounded-lg font-body text-sm font-semibold text-text-primary hover:underline ${FOCUS}`}
                >
                  {title}
                </Link>
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                  <FormatTag format={type} label={labels.format(type)} />
                  {item.year ? <span className="tabular-nums">{item.year}</span> : null}
                  {/* En el móvil el estado va aquí; desde md, en su columna. */}
                  <span className="md:hidden">· {progress ?? labels.status(item.status)}</span>
                </p>
              </div>
              <p className="hidden min-w-0 text-sm text-text-secondary md:block">
                <span className="block truncate font-semibold text-text-primary">{labels.status(item.status)}</span>
                {progress ? <span className="block truncate text-xs tabular-nums text-text-tertiary">{progress}</span> : null}
              </p>
              <p className="text-right text-sm tabular-nums text-text-primary md:text-left">
                {rating ? (
                  <>
                    <span aria-hidden="true" className="font-semibold">
                      {rating.value}
                    </span>
                    <span aria-hidden="true" className="text-xs text-text-tertiary">
                      /{rating.max}
                    </span>
                    <span className="sr-only">{t('yourRatingOf', { value: rating.value, max: rating.max })}</span>
                  </>
                ) : (
                  <span className="text-xs text-text-tertiary">{t('list.noRating')}</span>
                )}
              </p>
              <p className="hidden text-xs text-text-tertiary md:block">
                <time dateTime={touched.toISOString()} suppressHydrationWarning>
                  {formatSince(touched, locale)}
                </time>
              </p>
            </li>
          )
        })}
      </ul>
      {rest > 0 ? (
        <div className="mt-6">
          <KButton type="button" variant="secondary" onClick={() => setShown((n) => n + LIST_PAGE_SIZE)}>
            {t('album.more', { count: Math.min(rest, LIST_PAGE_SIZE), total: rest })}
          </KButton>
        </div>
      ) : null}
    </div>
  )
}
