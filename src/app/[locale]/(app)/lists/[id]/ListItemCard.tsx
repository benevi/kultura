import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { MediaCard } from '@/components/media/MediaCard'
import type { ListItem } from '@/types/list'
import { ItemNote } from './ItemNote'

interface ListItemCardProps {
  listId: string
  item: ListItem
  /** Posición (0 = primero); solo se pinta en un «Ranking personal». */
  index: number
  ranked: boolean
  canEdit: boolean
  removing: boolean
  onRemove: (itemId: string) => void
}

/** Un título de la rejilla: póster, número del ranking, quitar y nota. */
export function ListItemCard({ listId, item, index, ranked, canEdit, removing, onRemove }: ListItemCardProps) {
  const t = useTranslations('lists')

  return (
    <li className="relative group flex flex-col gap-2">
      {ranked && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-accent-lime px-2 font-display text-sm font-extrabold tabular-nums text-on-accent-lime shadow-sticker"
        >
          {index + 1}
        </span>
      )}
      {ranked && <span className="sr-only">{t('rankPosition', { position: index + 1 })}</span>}
      {item.media ? (
        <MediaCard item={item.media} />
      ) : (
        <div
          className="aspect-[2/3] rounded-2xl flex items-center justify-center bg-[linear-gradient(155deg,var(--surface2),var(--surface))]"
        >
          <span className="text-xs text-text-secondary text-center px-1 line-clamp-3">{item.mediaId}</span>
        </div>
      )}
      {canEdit && (
        // Visible también al enfocarlo con el teclado y en pantallas
        // táctiles (sin hover no se veía nunca); 44 px de zona táctil.
        <CloseButton
          onClick={() => onRemove(item.id)}
          disabled={removing}
          label={t('removeItemNamed', { title: item.media?.title ?? item.mediaId })}
          className="absolute top-0 right-0 bg-surface-base/80 hover:text-accent-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity"
        />
      )}
      {/* En la rejilla la nota solo se lee; se escribe en «Ordenar y
          anotar» (una fila por título, sin controles ocultos). */}
      {item.note ? (
        <ItemNote listId={listId} item={item} editable={false} onSaved={() => undefined} />
      ) : null}
    </li>
  )
}
