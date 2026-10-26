'use client'

import { useMemo } from 'react'
import { PageHeading } from '@/components/layout/PageHeading'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { FilterChip } from '@/components/ui/FilterChip'
import { KButton } from '@/components/ui/KButton'
import { MediaGrid } from '@/components/media/MediaGrid'
import { IconLibrary } from '@/components/icons'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DiaryList } from '@/components/library/DiaryList'
import type { DiaryLog, LibraryEntry, RatingScale } from '@/types/library'
import type { MediaItem, MediaType } from '@/types/media'

interface LibraryClientProps {
  entries: LibraryEntry[]
  /**
   * F-24: diario y escala de notas. `null` sin RATING_SCALE_10 o sin la
   * migración: la Biblioteca de siempre.
   */
  diary?: { logs: DiaryLog[]; scale: RatingScale } | null
}

function parseMediaId(mediaId: string): { type: MediaType; externalId: string } {
  const idx = mediaId.indexOf('_')
  return {
    type: mediaId.slice(0, idx) as MediaType,
    externalId: mediaId.slice(idx + 1),
  }
}

function entryToMediaItem(entry: LibraryEntry): MediaItem {
  const { type, externalId } = parseMediaId(entry.mediaId)
  return {
    id: entry.mediaId,
    externalId,
    type,
    title: entry.title ?? entry.mediaId,
    poster: entry.poster,
    year: entry.year,
  }
}

const TYPE_OPTIONS = [
  { value: 'movie' as const, labelKey: 'movie' as const },
  { value: 'tv' as const, labelKey: 'tv' as const },
  { value: 'anime' as const, labelKey: 'anime' as const },
  { value: 'book' as const, labelKey: 'book' as const },
  { value: 'comic' as const, labelKey: 'comic' as const },
  { value: 'manga' as const, labelKey: 'manga' as const },
  { value: 'game' as const, labelKey: 'game' as const },
]

const STATUS_OPTIONS = [
  { value: 'in_progress' as const, labelKey: 'inProgress' as const },
  { value: 'pending' as const, labelKey: 'pending' as const },
  { value: 'completed' as const, labelKey: 'completed' as const },
  { value: 'abandoned' as const, labelKey: 'dropped' as const },
]

/**
 * Fila de contadores con la que abre el artboard de Biblioteca: tarjetas
 * sueltas, cifra display en el color de su estado. Cuentan la biblioteca
 * ENTERA, no la vista filtrada: son el resumen, no el resultado.
 */
const COUNTERS = [
  { status: 'completed' as const, labelKey: 'completed' as const, tone: 'text-accent-lime' },
  { status: 'in_progress' as const, labelKey: 'inProgress' as const, tone: 'text-accent-blue' },
  { status: 'pending' as const, labelKey: 'pending' as const, tone: 'text-accent-yellow' },
  { status: 'abandoned' as const, labelKey: 'dropped' as const, tone: 'text-text-tertiary' },
]

const SCORE_OPTIONS = [
  { value: '5', label: '★★★★★ 5' },
  { value: '4', label: '★★★★ 4+' },
  { value: '3', label: '★★★ 3+' },
  { value: '2', label: '★★ 2+' },
]

function EmptyLibrary({ t }: { t: ReturnType<typeof useTranslations<'library'>> }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-5">
      <div
        className="w-20 h-20 rounded-bento bg-surface-elevated flex items-center justify-center"
        aria-hidden="true"
      >
        <IconLibrary className="w-9 h-9 text-text-tertiary" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="font-display text-xl font-semibold text-text-primary">
          {t('empty.title')}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t('empty.hint')}
        </p>
      </div>
      <KButton asChild variant="primary" size="md">
        <Link href="/discover">{t('empty.cta')}</Link>
      </KButton>
    </div>
  )
}

function EmptyFiltered({
  t,
  tF,
  onReset,
}: {
  t: ReturnType<typeof useTranslations<'library'>>
  tF: ReturnType<typeof useTranslations<'filters'>>
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
      <div
        className="w-16 h-16 rounded-bento bg-surface-elevated flex items-center justify-center text-3xl select-none"
        aria-hidden="true"
      >
        🔍
      </div>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <p className="font-body font-medium text-text-primary text-base">
          {t('empty.filtered')}
        </p>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t('empty.filteredHint')}
        </p>
      </div>
      <KButton variant="secondary" size="sm" onClick={onReset}>
        {tF('reset')}
      </KButton>
    </div>
  )
}

export function LibraryClient({ entries, diary = null }: LibraryClientProps) {
  const t = useTranslations('library')
  const tF = useTranslations('filters')
  const td = useTranslations('diary')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type') ?? 'all'
  const currentStatus = searchParams.get('status') ?? 'all'
  const currentScore = searchParams.get('score') ?? 'all'
  const onlyFavorites = diary !== null && searchParams.get('fav') === '1'
  const view = diary !== null && searchParams.get('view') === 'diary' ? 'diary' : 'collection'
  // F-28: la escala se elige en Ajustes; aquí solo se usa para pintar el diario.
  const scale: RatingScale = diary?.scale ?? 'stars'

  function push(next: Record<string, string>) {
    const params = new URLSearchParams()
    const merged = {
      type: currentType,
      status: currentStatus,
      score: currentScore,
      fav: onlyFavorites ? '1' : 'all',
      view,
      ...next,
    }
    if (merged.view === 'diary') params.set('view', 'diary')
    if (merged.type !== 'all') params.set('type', merged.type)
    if (merged.status !== 'all') params.set('status', merged.status)
    if (merged.score !== 'all') params.set('score', merged.score)
    if (merged.fav === '1') params.set('fav', '1')
    const qs = params.toString()
    router.push(`/library${qs ? `?${qs}` : ''}`)
  }

  function handleFilterChange(key: string, value: string) {
    push({ [key]: value })
  }

  function resetFilters() {
    router.push('/library')
  }

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => currentType === 'all' || e.mediaId.startsWith(currentType + '_'))
        .filter((e) => currentStatus === 'all' || e.status === currentStatus)
        .filter((e) => {
          if (currentScore === 'all') return true
          const min = parseInt(currentScore, 10)
          return e.score !== null && e.score >= min
        })
        .filter((e) => !onlyFavorites || e.favorite === true),
    [entries, currentType, currentStatus, currentScore, onlyFavorites]
  )

  const mediaItems = useMemo(
    () => filtered.map((e) => entryToMediaItem(e)),
    [filtered]
  )

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const e of entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1
    return byStatus
  }, [entries])

  const hasActiveFilters =
    currentType !== 'all' || currentStatus !== 'all' || currentScore !== 'all' || onlyFavorites

  // F-24: vista (colección / diario), solo con el diario activo. La escala de
  // notas se cambia en Ajustes (F-28).
  const diaryControls = diary ? (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <SegmentedControl
        ariaLabel={td('view')}
        value={view}
        onChange={(v) => push({ view: v })}
        options={[
          { value: 'collection', label: td('viewCollection') },
          { value: 'diary', label: td('viewDiary') },
        ]}
      />
    </div>
  ) : null

  if (diary && view === 'diary') {
    return (
      <div>
        <PageHeading emoji="📚">{t('title')}</PageHeading>
        {diaryControls}
        <DiaryList logs={diary.logs} scale={scale} />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div>
        <PageHeading emoji="📚">{t('title')}</PageHeading>
        {diaryControls}
        <EmptyLibrary t={t} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <PageHeading
        emoji="📚"
        action={
          <span className="shrink-0 rounded-pill bg-surface-elevated px-3 py-1 text-xs font-body font-semibold text-text-secondary">
            {t('items', { count: filtered.length })}
          </span>
        }
      >
        {t('title')}
      </PageHeading>

      {diaryControls}

      {/* Contadores (artboard): tarjetas sueltas, radio 20, cifra en color. */}
      <ul className="flex flex-wrap gap-4 mb-8" aria-label={t('title')}>
        {COUNTERS.map((c) => (
          <li key={c.status} className="bg-surface-default rounded-bento px-[26px] py-[18px] min-w-[150px]">
            <span className={`block font-display text-3xl font-extrabold leading-none tabular-nums ${c.tone}`}>
              {counts[c.status] ?? 0}
            </span>
            <span className="block mt-2 text-meta font-semibold text-text-tertiary">
              {t(`counters.${c.labelKey}`)}
            </span>
          </li>
        ))}
      </ul>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8 pb-6 border-b border-border">
        {/* Tipo */}
        <div role="group" aria-label={tF('type')}>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
            <FilterChip
              label={tF('all')}
              active={currentType === 'all'}
              onClick={() => handleFilterChange('type', 'all')}
            />
            {TYPE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={tF(opt.labelKey)}
                active={currentType === opt.value}
                onClick={() => handleFilterChange('type', currentType === opt.value ? 'all' : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Estado */}
        <div role="group" aria-label={tF('status')}>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
            <FilterChip
              label={tF('all')}
              active={currentStatus === 'all'}
              onClick={() => handleFilterChange('status', 'all')}
            />
            {STATUS_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={tF(opt.labelKey)}
                active={currentStatus === opt.value}
                onClick={() => handleFilterChange('status', currentStatus === opt.value ? 'all' : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Puntuación */}
        <div role="group" aria-label={tF('minScore')}>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
            <FilterChip
              label={tF('all')}
              active={currentScore === 'all'}
              onClick={() => handleFilterChange('score', 'all')}
            />
            {SCORE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={currentScore === opt.value}
                onClick={() => handleFilterChange('score', currentScore === opt.value ? 'all' : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Favoritos (F-24) */}
        {diary && (
          <div role="group" aria-label={td('favorite')}>
            <div className="flex gap-2">
              <FilterChip
                label={td('favorites')}
                active={onlyFavorites}
                onClick={() => handleFilterChange('fav', onlyFavorites ? 'all' : '1')}
              />
            </div>
          </div>
        )}

        {/* Reset rápido si hay filtros activos */}
        {hasActiveFilters && (
          <div className="flex">
            <KButton variant="secondary" size="sm" onClick={resetFilters}>
              {tF('reset')}
            </KButton>
          </div>
        )}
      </div>

      {/* Empty filtered */}
      {filtered.length === 0 && (
        <EmptyFiltered t={t} tF={tF} onReset={resetFilters} />
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <MediaGrid items={mediaItems} showType requirePoster={false} />
      )}
    </div>
  )
}
