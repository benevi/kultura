import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import type { List } from '@/types/list'

type FilterKey = 'movie' | 'tv' | 'anime' | 'book' | 'comic' | 'manga' | 'game'
const MEDIA_FILTER_KEYS = new Set<string>(['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'])

interface ListCardProps {
  list: List
}

export function ListCard({ list }: ListCardProps) {
  const tf = useTranslations('filters')
  const tl = useTranslations('lists')

  return (
    <Link
      href={`/lists/${list.id}`}
      className="block bg-surface-default border border-surface-border rounded-xl p-5 hover:border-accent-positive/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-text-primary leading-snug">{list.name}</h3>
        {list.isCollaborative && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-accent-positive/10 text-accent-positive">
            {tl('collaborative')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span>{MEDIA_FILTER_KEYS.has(list.mediaType) ? tf(list.mediaType as FilterKey) : list.mediaType}</span>
        <span>·</span>
        <span>{list.itemCount ?? 0} {tl('items')}</span>
        {list.owner && (
          <>
            <span>·</span>
            <span>{list.owner.username}</span>
          </>
        )}
      </div>
    </Link>
  )
}
