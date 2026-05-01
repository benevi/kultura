import Image from 'next/image'
import { Link } from '@/i18n/navigation'

export interface HeroItem {
  media_id: string
  episode_progress: { season?: number; episode: number; current?: number; total?: number } | null
  media: {
    id: string
    title: string
    poster: string | null
    year: number | null
    type: string
    synopsis: string | null
  } | null
}

interface HeroSectionProps {
  item: HeroItem | null
}

export function HeroSection({ item }: HeroSectionProps) {
  if (!item?.media) {
    return (
      <section className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-3">
        <p className="text-lg font-semibold text-text">¿Qué estás viendo?</p>
        <p className="text-sm text-muted">Añade títulos a tu biblioteca para ver tu progreso aquí</p>
        <Link
          href="/discover"
          className="w-fit px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Explorar contenido
        </Link>
      </section>
    )
  }

  const { media, episode_progress } = item
  const externalId = media.id.split('_').slice(1).join('_')
  const href = `/media/${media.type}/${externalId}`

  const progress = episode_progress?.current != null && episode_progress?.total != null
    ? Math.round((episode_progress.current / episode_progress.total) * 100)
    : null

  return (
    <section className="relative overflow-hidden rounded-xl min-h-48 md:min-h-64 p-4 md:p-6">
      {media.poster && (
        <>
          <Image
            src={media.poster}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
          <div className="absolute inset-0 bg-bg/80" />
        </>
      )}
      {!media.poster && <div className="absolute inset-0 bg-surface" />}

      <div className="relative z-10 flex gap-4">
        {media.poster && (
          <div className="w-24 md:w-36 flex-shrink-0 rounded-lg overflow-hidden aspect-[2/3] relative">
            <Image
              src={media.poster}
              alt={media.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 96px, 144px"
            />
          </div>
        )}

        <div className="flex flex-col justify-end min-w-0">
          <p className="text-xs text-muted-light uppercase tracking-wide mb-1">Continuando</p>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{media.title}</h2>
          <p className="text-sm text-muted-light mt-0.5">
            {[media.year, media.type].filter(Boolean).join(' · ')}
          </p>
          {media.synopsis && (
            <p className="text-sm text-muted-light line-clamp-2 md:line-clamp-3 mt-1">
              {media.synopsis}
            </p>
          )}

          {progress !== null && (
            <div className="mt-3 w-full max-w-xs">
              <div className="bg-surface2 rounded-full h-1.5">
                <div
                  className="bg-accent rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          <Link
            href={href}
            className="mt-3 w-fit inline-flex items-center px-3 py-1.5 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            Continuar
          </Link>
        </div>
      </div>
    </section>
  )
}
