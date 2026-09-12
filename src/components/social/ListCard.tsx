import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import type { List } from '@/types/list'

type FilterKey = 'movie' | 'tv' | 'anime' | 'book' | 'comic' | 'manga' | 'game'
const MEDIA_FILTER_KEYS = new Set<string>(['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'])

// Portada sin imagen real (F0/CLAUDE.md): gradiente lineal de dos paradas con
// el mismo matiz (más oscuro en la segunda parada) + acento radial en la
// esquina superior-izquierda ("cards feature grandes"). El matiz se deriva
// del id de la lista para que cada tarjeta tenga un color estable y propio,
// nunca un gris plano.
function listCoverBackground(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return [
    `radial-gradient(120% 100% at 20% 10%, oklch(88% 0.19 ${hue} / 55%), transparent 55%)`,
    `linear-gradient(155deg, oklch(48% 0.14 ${hue}), oklch(25% 0.075 ${hue}))`,
  ].join(', ')
}

interface ListCardProps {
  list: List
}

export function ListCard({ list }: ListCardProps) {
  const tf = useTranslations('filters')
  const tl = useTranslations('lists')

  return (
    <Link href={`/lists/${list.id}`} className="group block">
      <div
        className="relative h-[150px] rounded-bento overflow-hidden p-5 flex flex-col justify-between transition-transform duration-200 ease-standard group-hover:-translate-y-1"
        style={{ background: listCoverBackground(list.id) }}
      >
        <h3 className="font-display text-base font-extrabold leading-tight text-white line-clamp-2">
          {list.name}
        </h3>
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-semibold text-white/80">
            {list.itemCount ?? 0} {tl('items')}
          </span>
          {list.isCollaborative && (
            <span
              className="flex-shrink-0 rounded-full bg-black/40 backdrop-blur-sm text-white text-[11px] font-bold w-7 h-7 flex items-center justify-center leading-none"
              title={tl('collaborative')}
              aria-label={tl('collaborative')}
            >
              👥
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-secondary font-medium pt-3 flex-wrap">
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
