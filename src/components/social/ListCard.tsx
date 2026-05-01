import { Link } from '@/i18n/navigation'
import type { List } from '@/types/list'

const TYPE_LABELS: Record<string, string> = {
  movie: 'Películas', tv: 'Series', anime: 'Anime',
  book: 'Libros', comic: 'Cómics', manga: 'Manga', game: 'Videojuegos',
}

interface ListCardProps {
  list: List
}

export function ListCard({ list }: ListCardProps) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="block bg-surface border border-border rounded-xl p-5 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-text leading-snug">{list.name}</h3>
        {list.isCollaborative && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            Colaborativa
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>{TYPE_LABELS[list.mediaType] ?? list.mediaType}</span>
        <span>·</span>
        <span>{list.itemCount ?? 0} títulos</span>
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
