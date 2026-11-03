'use client'

// ============================================================
// KULTURA — Biblioteca: tu álbum (DISENO.md)
//
// Tres vistas, en la URL (`?view=`):
// - álbum (por defecto): una página por estado con huecos numerados para lo
//   pendiente y cromos puestos, pegados o doblados para lo demás
//   (`AlbumView`);
// - lista: la vista densa para operar, con búsqueda, orden y filtro de nota
//   (`LibraryList`);
// - diario (con F-24): tus apuntes por mes (`DiaryList`).
// Encima, las pestañas de formato (fijas al hacer scroll) y el resumen por
// estado, que también filtra. Los recuentos son de la biblioteca ENTERA:
// son el resumen, no el resultado del filtro.
// ============================================================

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { PageHeading } from '@/components/layout/PageHeading'
import { FilterChip } from '@/components/ui/FilterChip'
import { KButton } from '@/components/ui/KButton'
import { Select } from '@/components/ui/Select'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Slot } from '@/components/album/Slot'
import { useAlbumLabels } from '@/components/album/labels'
import { IconLibrary } from '@/components/icons'
import { DiaryList } from '@/components/library/DiaryList'
import { AlbumView } from '@/components/library/AlbumView'
import { LibraryList } from '@/components/library/LibraryList'
import {
  ALBUM_STATUSES,
  LIBRARY_SORTS,
  isLibrarySort,
  matchesQuery,
  parseMediaId,
  sortItems,
  type LibraryItem,
  type LibrarySort,
} from '@/components/library/library-item'
import type { DisplayScale } from '@/components/library/rating-display'
import { FORMATS, FORMAT_COLOR } from '@/lib/design/album'
import { formatCount } from '@/lib/design/format'
import { entryRating10 } from '@/lib/library/rating'
import { cn } from '@/lib/utils/index'
import type { DiaryLog, LibraryEntry, LibraryStatus, RatingScale } from '@/types/library'
import type { MediaType } from '@/types/media'

interface LibraryClientProps {
  entries: LibraryEntry[]
  /**
   * F-24: diario y escala de notas. `null` sin RATING_SCALE_10 o sin la
   * migración: la Biblioteca de siempre.
   */
  diary?: { logs: DiaryLog[]; scale: RatingScale } | null
  /** Escala de tus notas sin diario (`legacy`: estrellas enteras). */
  scale?: DisplayScale
}

type View = 'album' | 'list' | 'diary'

/** Nombre de cada estado en el filtro (namespace `filters`). */
const STATUS_FILTER_KEY = {
  in_progress: 'inProgress',
  pending: 'pending',
  completed: 'completed',
  abandoned: 'dropped',
} as const satisfies Record<LibraryStatus, string>

/** Nota mínima del filtro, sobre 5 (`?score=4` = 4 de 5 o más, 8 de 10 o más). */
const SCORE_MIN = [5, 4, 3, 2] as const

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

function EmptyLibrary({ t }: { t: ReturnType<typeof useTranslations<'library'>> }) {
  return (
    <div className="flex flex-col items-start gap-6 py-10">
      {/* La primera página del álbum, aún sin nada: huecos sin título. */}
      <ul aria-hidden="true" className="grid w-full max-w-md grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>
            <Slot number={n} title="" />
          </li>
        ))}
      </ul>
      <div className="flex max-w-prose flex-col gap-2">
        <h2 className="font-display text-2xl text-text-primary">{t('empty.title')}</h2>
        <p className="text-sm leading-relaxed text-text-secondary">{t('empty.hint')}</p>
      </div>
      <KButton asChild variant="primary" size="lg">
        <Link href="/discover">{t('empty.cta')}</Link>
      </KButton>
    </div>
  )
}

function EmptyFiltered({ t, onReset, resetLabel }: { t: ReturnType<typeof useTranslations<'library'>>; onReset: () => void; resetLabel: string }) {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <p className="font-body text-base font-semibold text-text-primary">{t('empty.filtered')}</p>
      <p className="max-w-prose text-sm leading-relaxed text-text-secondary">{t('empty.filteredHint')}</p>
      <KButton variant="secondary" size="sm" onClick={onReset}>
        {resetLabel}
      </KButton>
    </div>
  )
}

export function LibraryClient({ entries, diary = null, scale: baseScale = 'legacy' }: LibraryClientProps) {
  const t = useTranslations('library')
  const tF = useTranslations('filters')
  const td = useTranslations('diary')
  const labels = useAlbumLabels()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawType = searchParams.get('type') ?? 'all'
  const currentType: MediaType | 'all' = (FORMATS as readonly string[]).includes(rawType) ? (rawType as MediaType) : 'all'
  const rawStatus = searchParams.get('status') ?? 'all'
  const currentStatus: LibraryStatus | 'all' = (ALBUM_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as LibraryStatus)
    : 'all'
  const rawScore = Number(searchParams.get('score'))
  const currentScore = (SCORE_MIN as readonly number[]).includes(rawScore) ? rawScore : null
  const onlyFavorites = diary !== null && searchParams.get('fav') === '1'
  const rawView = searchParams.get('view')
  const view: View = rawView === 'diary' && diary !== null ? 'diary' : rawView === 'list' ? 'list' : 'album'
  const rawSort = searchParams.get('sort')
  const sort: LibrarySort = isLibrarySort(rawSort) ? rawSort : 'recent'
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  // F-28: la escala se elige en Ajustes; aquí solo se usa para pintar las notas.
  const scale: DisplayScale = diary?.scale ?? baseScale
  const items = entries as LibraryItem[]

  function push(next: Record<string, string>) {
    const merged: Record<string, string> = {
      view,
      type: currentType,
      status: currentStatus,
      score: currentScore === null ? 'all' : String(currentScore),
      fav: onlyFavorites ? '1' : 'all',
      sort,
      ...next,
    }
    const params = new URLSearchParams()
    if (merged.view !== 'album') params.set('view', merged.view)
    if (merged.type !== 'all') params.set('type', merged.type)
    if (merged.status !== 'all') params.set('status', merged.status)
    if (merged.score !== 'all') params.set('score', merged.score)
    if (merged.fav === '1') params.set('fav', '1')
    if (merged.sort !== 'recent') params.set('sort', merged.sort)
    const qs = params.toString()
    router.push(`/library${qs ? `?${qs}` : ''}`)
  }

  function resetFilters() {
    setQuery('')
    push({ type: 'all', status: 'all', score: 'all', fav: 'all' })
  }

  // Resumen de la biblioteca entera (por estado y por formato).
  const counts = useMemo(() => {
    const byStatus: Partial<Record<LibraryStatus, number>> = {}
    const byType: Partial<Record<MediaType, number>> = {}
    for (const e of items) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
      const { type } = parseMediaId(e.mediaId)
      byType[type] = (byType[type] ?? 0) + 1
    }
    return { byStatus, byType }
  }, [items])

  const inList = view === 'list'
  const filtered = useMemo(() => {
    const base = items
      .filter((e) => currentType === 'all' || e.mediaId.startsWith(`${currentType}_`))
      .filter((e) => currentStatus === 'all' || e.status === currentStatus)
      .filter((e) => !onlyFavorites || e.favorite === true)
    if (!inList) return base
    const scored = base
      .filter((e) => currentScore === null || (entryRating10(e) ?? 0) >= currentScore * 2)
      .filter((e) => matchesQuery(e, query))
    return sortItems(scored, sort, locale)
  }, [items, currentType, currentStatus, onlyFavorites, inList, currentScore, query, sort, locale])

  const hasActiveFilters =
    currentType !== 'all' ||
    currentStatus !== 'all' ||
    onlyFavorites ||
    (inList && (currentScore !== null || query.trim() !== ''))

  const viewOptions = [
    { value: 'album', label: t('views.album') },
    { value: 'list', label: t('views.list') },
    ...(diary ? [{ value: 'diary', label: td('viewDiary') }] : []),
  ]
  const viewSwitch = (
    <SegmentedControl ariaLabel={td('view')} value={view} onChange={(v) => push({ view: v })} options={viewOptions} />
  )

  const heading = (
    <PageHeading
      icon={IconLibrary}
      action={
        entries.length > 0 ? (
          <span className="shrink-0 rounded-pill bg-surface-elevated px-3 py-1 font-body text-xs font-semibold text-text-secondary">
            {t('items', { count: entries.length })}
          </span>
        ) : undefined
      }
    >
      {t('title')}
    </PageHeading>
  )

  if (diary && view === 'diary') {
    return (
      <div>
        {heading}
        <div className="mb-6">{viewSwitch}</div>
        <DiaryList logs={diary.logs} scale={diary.scale} />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div>
        {heading}
        <EmptyLibrary t={t} />
      </div>
    )
  }

  const presentFormats = FORMATS.filter((f) => (counts.byType[f] ?? 0) > 0)

  return (
    <div>
      {heading}
      <div className="mb-5">{viewSwitch}</div>

      {/* Pestañas de formato, fijas bajo la cabecera (patrón permitido). */}
      <div className="sticky top-[3.625rem] z-20 -mx-4 mb-5 border-b-2 border-surface-border bg-surface-base px-4 md:-mx-8 md:px-8">
        <div role="group" aria-label={tF('type')} className="scrollbar-hide flex gap-1 overflow-x-auto">
          {[{ value: 'all' as const, label: tF('all'), count: items.length }, ...presentFormats.map((f) => ({ value: f, label: labels.format(f), count: counts.byType[f] ?? 0 }))].map(
            (tab) => {
              const active = currentType === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => push({ type: active && tab.value !== 'all' ? 'all' : tab.value })}
                  className={cn(
                    'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors',
                    'after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full',
                    FOCUS,
                    active ? 'text-text-primary after:bg-wayfinding' : 'text-text-tertiary hover:text-text-primary'
                  )}
                >
                  {tab.value !== 'all' ? (
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: FORMAT_COLOR[tab.value] }} />
                  ) : null}
                  {tab.label}
                  <span className="font-normal tabular-nums text-text-tertiary">{formatCount(tab.count, locale)}</span>
                </button>
              )
            }
          )}
        </div>
      </div>

      {/* Resumen por estado (biblioteca entera); también filtra. */}
      <div role="group" aria-label={tF('status')} className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ALBUM_STATUSES.map((status) => {
          const active = currentStatus === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              data-status-count={status}
              onClick={() => push({ status: active ? 'all' : status })}
              className={cn(
                'flex min-h-11 items-baseline justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors',
                FOCUS,
                active
                  ? 'border-text-primary bg-text-primary text-surface-base'
                  : 'border-surface-border bg-surface-default text-text-primary hover:border-text-tertiary'
              )}
            >
              <span className="text-sm font-semibold">{tF(STATUS_FILTER_KEY[status])}</span>
              <span className="text-lg font-bold tabular-nums">{formatCount(counts.byStatus[status] ?? 0, locale)}</span>
            </button>
          )
        })}
      </div>

      {/* Controles de la lista (y favoritos en las dos vistas). */}
      {inList || diary || hasActiveFilters ? (
        <div className="mb-8 flex flex-col gap-4 border-b-2 border-surface-border pb-6">
          {inList ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="library-search" className="font-body text-meta font-bold text-text-tertiary">
                  {t('list.search')}
                </label>
                <input
                  id="library-search"
                  type="search"
                  name="q"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('list.searchPlaceholder')}
                  className={`h-11 w-full rounded-lg border border-field-border bg-surface-elevated px-4 font-body text-base text-text-primary placeholder:text-text-tertiary md:text-body ${FOCUS}`}
                />
              </div>
              <div className="sm:w-56">
                <Select
                  label={t('list.sort')}
                  value={sort}
                  onChange={(v) => push({ sort: v })}
                  options={LIBRARY_SORTS.map((s) => ({ value: s, label: t(`list.sorts.${s}`) }))}
                />
              </div>
            </div>
          ) : null}

          {inList ? (
            <div role="group" aria-label={tF('minScore')} className="scrollbar-hide flex flex-nowrap gap-2 overflow-x-auto pb-1">
              <FilterChip label={tF('all')} active={currentScore === null} onClick={() => push({ score: 'all' })} />
              {SCORE_MIN.map((n) => {
                const max = scale === 'ten' ? 10 : 5
                const value = scale === 'ten' ? n * 2 : n
                return (
                  <FilterChip
                    key={n}
                    label={t('list.minRating', { value, max })}
                    active={currentScore === n}
                    onClick={() => push({ score: currentScore === n ? 'all' : String(n) })}
                  />
                )
              })}
            </div>
          ) : null}

          {diary || hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {diary ? (
                <FilterChip
                  label={td('favorites')}
                  active={onlyFavorites}
                  onClick={() => push({ fav: onlyFavorites ? 'all' : '1' })}
                />
              ) : null}
              {hasActiveFilters ? (
                <KButton variant="secondary" size="sm" onClick={resetFilters}>
                  {tF('reset')}
                </KButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyFiltered t={t} onReset={resetFilters} resetLabel={tF('reset')} />
      ) : inList ? (
        <LibraryList items={filtered} scale={scale} />
      ) : (
        <AlbumView
          items={filtered}
          scale={scale}
          showFormat={currentType === 'all'}
          only={currentStatus === 'all' ? null : currentStatus}
        />
      )}
    </div>
  )
}
