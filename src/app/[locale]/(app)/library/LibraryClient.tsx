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
  { value: 'movie' as const, labelKey: 'movie' as const, emoji: '🎬' },
  { value: 'tv' as const, labelKey: 'tv' as const, emoji: '📺' },
  { value: 'anime' as const, labelKey: 'anime' as const, emoji: '🍥' },
  { value: 'book' as const, labelKey: 'book' as const, emoji: '📚' },
  { value: 'comic' as const, labelKey: 'comic' as const, emoji: '💥' },
  { value: 'manga' as const, labelKey: 'manga' as const, emoji: '🀄' },
  { value: 'game' as const, labelKey: 'game' as const, emoji: '🎮' },
]

// Tarjetas de recuento (F0 Library): número display en un color vivo por
// estado, etiqueta muted debajo. Mismo orden que el mockup.
const STAT_CARDS = [
  { status: 'completed' as const, labelKey: 'completed' as const, color: 'text-accent-lime' },
  { status: 'in_progress' as const, labelKey: 'inProgress' as const, color: 'text-accent-blue' },
  { status: 'pending' as const, labelKey: 'pending' as const, color: 'text-accent-yellow' },
  { status: 'abandoned' as const, labelKey: 'dropped' as const, color: 'text-text-tertiary' },
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
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-5">
      <div
        className="w-20 h-20 rounded-[20px] bg-surface-elevated flex items-center justify-center text-4xl select-none"
        aria-hidden="true"
      >
        📚
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
        className="w-16 h-16 rounded-[20px] bg-surface-elevated flex items-center justify-center text-3xl select-none"
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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) counts[e.status] = (counts[e.status] ?? 0) + 1
    return counts
  }, [entries])

  const title = (
    <h1 className="font-display text-[34px] md:text-[42px] font-bold text-text-primary mb-[22px]">
      {t('title')} <span aria-hidden="true">📚</span>
    </h1>
  )

  if (entries.length === 0) {
    return (
      <div>
        {title}
        <EmptyLibrary t={t} />
      </div>
    )
  }

  return (
    <div>
      {/* Header — título display + tarjetas de recuento por estado (F0) */}
      <section className="pb-6">
        {title}
        <div className="flex gap-4 overflow-x-auto scrollbar-hide md:flex-wrap">
          {STAT_CARDS.map(({ status, labelKey, color }) => (
            <div
              key={status}
              className="shrink-0 min-w-[150px] rounded-[20px] bg-surface-default px-[26px] py-[18px]"
            >
              <div className={`font-display text-[30px] font-extrabold leading-none ${color}`}>
                {statusCounts[status] ?? 0}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-text-tertiary">
                {tF(labelKey)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Filtros — estado (chips sólidos), tipo y puntuación (chips outline) */}
      <div className="flex flex-col gap-3.5 mb-8">
        <div
          role="group"
          aria-label={tF('status')}
          className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide flex-nowrap"
        >
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

        <div
          role="group"
          aria-label={tF('type')}
          className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide flex-nowrap"
        >
          {TYPE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              variant="outline"
              emoji={opt.emoji}
              label={tF(opt.labelKey)}
              active={currentType === opt.value}
              onClick={() => handleFilterChange('type', currentType === opt.value ? 'all' : opt.value)}
            />
          ))}
        </div>

        <div
          role="group"
          aria-label={tF('minScore')}
          className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide flex-nowrap items-center"
        >
          {SCORE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              variant="outline"
              label={opt.label}
              active={currentScore === opt.value}
              onClick={() => handleFilterChange('score', currentScore === opt.value ? 'all' : opt.value)}
            />
          ))}
          {hasActiveFilters && (
            <KButton variant="secondary" size="sm" onClick={resetFilters} className="ml-auto shrink-0">
              {tF('reset')}
            </KButton>
          )}
        </div>

        <p className="text-[13px] font-semibold text-text-tertiary">
          {filtered.length} {t('items')}
        </p>
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
