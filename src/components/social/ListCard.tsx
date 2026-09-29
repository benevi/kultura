import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import type { List } from '@/types/list'
import { cardGradient, hueFromSeed } from '@/lib/design/gradient'

type FilterKey = 'movie' | 'tv' | 'anime' | 'book' | 'comic' | 'manga' | 'game'
const MEDIA_FILTER_KEYS = new Set<string>(['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'])

// Portada sin imagen real (F0/DISENO.md, mockup Lists): gradiente lineal de
// dos paradas con el mismo matiz, derivado del id de la lista para que cada
// tarjeta tenga un color estable y propio, nunca un gris plano.
interface ListCardProps {
  list: List
}

export function ListCard({ list }: ListCardProps) {
  const tf = useTranslations('filters')
  const tl = useTranslations('lists')

  return (
    <Link href={`/lists/${list.id}`} className="group block">
      <div
        className="relative h-[150px] rounded-[20px] overflow-hidden p-5 flex flex-col justify-between transition-transform duration-200 ease-standard group-hover:-translate-y-1"
        style={{ background: cardGradient(hueFromSeed(list.id)) }}
      >
        <h3 className="font-display text-[17px] font-extrabold leading-tight text-text-primary line-clamp-2">
          {list.name}
        </h3>
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-semibold text-text-secondary">
            {list.itemCount ?? 0} {tl('items')}
          </span>
          {list.isCollaborative && (
            <span
              className="flex-shrink-0 rounded-full bg-black/40 text-text-primary text-[11px] font-bold px-2 py-1 flex items-center justify-center leading-none"
              title={tl('collaborative')}
              aria-label={tl('collaborative')}
            >
              👥
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-tertiary font-semibold pt-3 flex-wrap">
        <span>{MEDIA_FILTER_KEYS.has(list.mediaType) ? tf(list.mediaType as FilterKey) : list.mediaType}</span>
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
