'use client'

// ============================================================
// KULTURA — La Biblioteca como álbum (DISENO.md)
// Una página por estado, en este orden: en curso (cromos puestos con la tira
// de progreso y «hace N días»), pendiente (huecos numerados con el título
// impreso dentro), completado (cromos pegados; brillo en los 10/10) y
// abandonado (cromos con la esquina doblada, que se pueden retomar). Cada
// hueco lleva su banda: estado (o progreso) y días desde que lo tocaste.
//
// Rendimiento (WIG): cada página enseña 24 huecos y «Ver más» abre los
// siguientes; las páginas fuera de pantalla no se pintan
// (`content-visibility: auto`). Un solo pegado escalonado al montar (en la
// app nada va ligado al scroll), nada con movimiento reducido.
// ============================================================

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Cromo } from '@/components/album/Cromo'
import { Slot } from '@/components/album/Slot'
import { StatusBand } from '@/components/album/StatusBand'
import { FormatTag } from '@/components/album/FormatTag'
import { useAlbumLabels } from '@/components/album/labels'
import { KButton } from '@/components/ui/KButton'
import { albumShapeFor, isFoil } from '@/lib/design/album'
import { formatCount } from '@/lib/design/format'
import { hasProgress, progressRatio } from '@/lib/library/progress'
import { entryRating10 } from '@/lib/library/rating'
import { usePasteGrid } from '@/lib/motion/usePasteGrid'
import type { LibraryStatus } from '@/types/library'
import { ALBUM_STATUSES, albumOrder, itemHref, parseMediaId, type LibraryItem } from './library-item'
import { ratingParts, type DisplayScale } from './rating-display'
import { useProgressLabel } from './useProgressLabel'

/** Huecos por página del álbum. */
export const ALBUM_PAGE_SIZE = 24

/** La misma rejilla que `MediaGrid` (3/4/5/6 columnas, hueco 12). */
const GRID = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3'
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring'

interface AlbumViewProps {
  items: LibraryItem[]
  scale: DisplayScale
  /** Con «Todos» los formatos, cada cromo dice el suyo (punto + nombre). */
  showFormat: boolean
  /** Solo esta página (filtro de estado). */
  only?: LibraryStatus | null
}

export function AlbumView({ items, scale, showFormat, only = null }: AlbumViewProps) {
  const labels = useAlbumLabels()
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)
  usePasteGrid(rootRef, { selector: '[data-album-item]', enabled: items.length > 0 })

  const pages = ALBUM_STATUSES.filter((s) => only === null || s === only)
    .map((status) => ({ status, items: albumOrder(items.filter((i) => i.status === status), status) }))
    .filter((p) => p.items.length > 0)

  return (
    <div ref={rootRef} className="flex flex-col gap-12">
      {pages.map((page) => (
        <AlbumPageSection
          key={page.status}
          status={page.status}
          items={page.items}
          scale={scale}
          showFormat={showFormat}
          title={labels.status(page.status)}
          count={formatCount(page.items.length, locale)}
          labels={labels}
          locale={locale}
        />
      ))}
    </div>
  )
}

interface SectionProps {
  status: LibraryStatus
  items: LibraryItem[]
  scale: DisplayScale
  showFormat: boolean
  title: string
  count: string
  labels: ReturnType<typeof useAlbumLabels>
  locale: string
}

function AlbumPageSection({ status, items, scale, showFormat, title, count, labels, locale }: SectionProps) {
  const t = useTranslations('library')
  const progressLabel = useProgressLabel()
  const [shown, setShown] = useState(ALBUM_PAGE_SIZE)
  const visible = items.slice(0, shown)
  const rest = items.length - visible.length
  const headingId = `album-${status}`

  return (
    <section
      id={headingId}
      aria-labelledby={`${headingId}-title`}
      className="scroll-mt-32 [contain-intrinsic-size:auto_40rem] [content-visibility:auto]"
    >
      <h2 id={`${headingId}-title`} className="mb-4 flex items-baseline gap-2 font-display text-2xl text-text-primary">
        {title}
        <span className="font-body text-base font-semibold tabular-nums text-text-tertiary">{count}</span>
      </h2>
      <ul className={GRID}>
        {visible.map((item, index) => (
          <AlbumItem
            key={item.id}
            item={item}
            number={index + 1}
            scale={scale}
            showFormat={showFormat}
            labels={labels}
            locale={locale}
            progressLabel={progressLabel}
          />
        ))}
      </ul>
      {rest > 0 ? (
        <div className="mt-6">
          <KButton type="button" variant="secondary" onClick={() => setShown((n) => n + ALBUM_PAGE_SIZE)}>
            {t('album.more', { count: Math.min(rest, ALBUM_PAGE_SIZE), total: rest })}
          </KButton>
        </div>
      ) : null}
    </section>
  )
}

interface ItemProps {
  item: LibraryItem
  number: number
  scale: DisplayScale
  showFormat: boolean
  labels: ReturnType<typeof useAlbumLabels>
  locale: string
  progressLabel: ReturnType<typeof useProgressLabel>
}

function AlbumItem({ item, number, scale, showFormat, labels, locale, progressLabel }: ItemProps) {
  const t = useTranslations('library')
  const { type } = parseMediaId(item.mediaId)
  const title = item.title ?? t('untitled')
  const shape = albumShapeFor(item.status)
  const touchedAt = item.updatedAt ?? null
  const formatTag = showFormat ? <FormatTag format={type} label={labels.format(type)} className="mt-1" /> : null

  if (shape === 'slot') {
    return (
      <li data-album-item="" className="min-w-0">
        <Link href={itemHref(item)} className={`group block rounded-cromo ${FOCUS}`}>
          <Slot
            number={number}
            title={title}
            format={type}
            formatLabel={labels.format(type)}
            label={labels.slotPending(number)}
            band={
              <>
                {formatTag}
                <StatusBand status={item.status} label={labels.status(item.status)} touchedAt={touchedAt} locale={locale} />
              </>
            }
          />
        </Link>
      </li>
    )
  }

  const rating10 = entryRating10(item)
  const rating = shape === 'placed' ? null : ratingParts(rating10, scale, locale)
  const foil = shape === 'pasted' && isFoil(rating10)
  const ratio = shape === 'placed' ? progressRatio(type, item.progress) : null
  const progressText = shape === 'placed' && hasProgress(item.progress) ? progressLabel(type, item.progress) : null

  return (
    <li data-album-item="" className="min-w-0">
      <Link href={itemHref(item)} className={`group block rounded-cromo ${FOCUS}`}>
        <Cromo
          title={title}
          seed={item.mediaId}
          poster={item.poster}
          sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 160px"
          state={shape}
          format={type}
          progress={ratio ?? undefined}
          progressLabel={progressText ?? undefined}
          stateLabel={shape === 'folded' ? labels.folded() : foil ? labels.foil() : undefined}
          foil={foil}
        >
          {rating ? (
            <span className="absolute bottom-1.5 right-1.5 z-[1] inline-flex h-6 items-center rounded-cromo bg-surface-base px-1.5 text-xs font-bold leading-none tabular-nums text-text-primary">
              <span aria-hidden="true">{rating.value}</span>
              <span className="sr-only">{t('yourRatingOf', { value: rating.value, max: rating.max })}</span>
            </span>
          ) : null}
        </Cromo>
        <h3 className="mt-2 line-clamp-2 break-words font-body text-sm font-semibold leading-tight text-text-primary" title={title}>
          {title}
        </h3>
        {formatTag}
        <StatusBand
          status={item.status}
          label={progressText ?? labels.status(item.status)}
          touchedAt={touchedAt}
          locale={locale}
          className="mt-1.5"
        />
      </Link>
    </li>
  )
}
