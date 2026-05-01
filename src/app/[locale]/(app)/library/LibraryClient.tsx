'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { FilterBar, type FilterGroup } from '@/components/ui/FilterBar'
import { MediaGrid } from '@/components/media/MediaGrid'
import { Button } from '@/components/ui/button'
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

export function LibraryClient({ entries }: LibraryClientProps) {
  const t = useTranslations('library')
  const tF = useTranslations('filters')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type') ?? 'all'
  const currentStatus = searchParams.get('status') ?? 'all'
  const currentScore = searchParams.get('score') ?? 'all'

  const items = entries

  const filterGroups: FilterGroup[] = [
    {
      key: 'type',
      label: tF('type'),
      options: [
        { value: 'movie', label: tF('movie') },
        { value: 'tv', label: tF('tv') },
        { value: 'anime', label: tF('anime') },
        { value: 'book', label: tF('book') },
        { value: 'comic', label: tF('comic') },
        { value: 'manga', label: tF('manga') },
        { value: 'game', label: tF('game') },
      ],
    },
    {
      key: 'status',
      label: tF('status'),
      options: [
        { value: 'in_progress', label: tF('inProgress') },
        { value: 'pending', label: tF('pending') },
        { value: 'completed', label: tF('completed') },
        { value: 'abandoned', label: tF('dropped') },
      ],
    },
    {
      key: 'score',
      label: tF('minScore'),
      options: [
        { value: '5', label: '5' },
        { value: '4', label: '4+' },
        { value: '3', label: '3+' },
        { value: '2', label: '2+' },
      ],
    },
  ]

  const activeFilters: Record<string, string> = {
    type: currentType,
    status: currentStatus,
    score: currentScore,
  }

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
      items
        .filter((e) => currentType === 'all' || e.mediaId.startsWith(currentType + '_'))
        .filter((e) => currentStatus === 'all' || e.status === currentStatus)
        .filter((e) => {
          if (currentScore === 'all') return true
          const min = parseInt(currentScore, 10)
          return e.score !== null && e.score >= min
        }),
    [items, currentType, currentStatus, currentScore]
  )

  const mediaItems = useMemo(
    () => filtered.map((e) => entryToMediaItem(e)),
    [filtered]
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">{t('title')}</h1>
        <span className="text-muted text-sm">
          {filtered.length} {t('items')}
        </span>
      </div>

      {/* FilterBar */}
      <div className="mb-6">
        <FilterBar
          groups={filterGroups}
          activeFilters={activeFilters}
          onChange={handleFilterChange}
        />
      </div>

      {/* Empty: no items at all */}
      {items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg font-medium text-text">{t('emptyTitle')}</p>
          <p className="text-muted text-sm mt-1">{t('emptyHint')}</p>
          <Button asChild className="mt-4">
            <Link href="/discover">{t('goDiscover')}</Link>
          </Button>
        </div>
      )}

      {/* Empty: items exist but filters produce no results */}
      {items.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">{t('noResults')}</p>
          <button
            onClick={resetFilters}
            className="text-accent text-sm mt-2 hover:text-accent/80 transition-colors"
          >
            {tF('reset')}
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <MediaGrid items={mediaItems} showType />
      )}
    </div>
  )
}
