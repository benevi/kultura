'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { FilterChip } from '@/components/ui/FilterChip'
import { KButton } from '@/components/ui/KButton'
import { MediaGrid } from '@/components/media/MediaGrid'
import type { LibraryEntry } from '@/types/library'
import type { MediaItem, MediaType } from '@/types/media'

interface LibraryClientProps {
  entries: LibraryEntry[]
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

const SCORE_OPTIONS = [
  { value: '5', label: '★★★★★ 5' },
  { value: '4', label: '★★★★ 4+' },
  { value: '3', label: '★★★ 3+' },
  { value: '2', label: '★★ 2+' },
]

function EmptyLibrary({ t }: { t: ReturnType<typeof useTranslations<'library'>> }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-4">
      <div className="text-5xl select-none" aria-hidden="true">📚</div>
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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
      <div className="text-4xl select-none" aria-hidden="true">🔍</div>
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

export function LibraryClient({ entries }: LibraryClientProps) {
  const t = useTranslations('library')
  const tF = useTranslations('filters')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type') ?? 'all'
  const currentStatus = searchParams.get('status') ?? 'all'
  const currentScore = searchParams.get('score') ?? 'all'

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams()
    const newType = key === 'type' ? value : currentType
    const newStatus = key === 'status' ? value : currentStatus
    const newScore = key === 'score' ? value : currentScore
    if (newType !== 'all') params.set('type', newType)
    if (newStatus !== 'all') params.set('status', newStatus)
    if (newScore !== 'all') params.set('score', newScore)
    const qs = params.toString()
    router.push(`/library${qs ? `?${qs}` : ''}`)
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
        }),
    [entries, currentType, currentStatus, currentScore]
  )

  const mediaItems = useMemo(
    () => filtered.map((e) => entryToMediaItem(e)),
    [filtered]
  )

  const hasActiveFilters = currentType !== 'all' || currentStatus !== 'all' || currentScore !== 'all'

  if (entries.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-8">{t('title')}</h1>
        <EmptyLibrary t={t} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-text-primary">{t('title')}</h1>
        <span className="text-text-tertiary text-sm font-body">
          {filtered.length} {t('items')}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Tipo */}
        <div>
          <p className="text-xs font-body font-medium text-text-tertiary uppercase tracking-wider mb-2">
            {tF('type')}
          </p>
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
        <div>
          <p className="text-xs font-body font-medium text-text-tertiary uppercase tracking-wider mb-2">
            {tF('status')}
          </p>
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
        <div>
          <p className="text-xs font-body font-medium text-text-tertiary uppercase tracking-wider mb-2">
            {tF('minScore')}
          </p>
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
        <MediaGrid items={mediaItems} showType />
      )}
    </div>
  )
}
