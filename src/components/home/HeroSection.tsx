'use client'

import { PosterImage } from '@/components/media/PosterImage'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { ContinueProgress, canQuickAdvance } from '@/components/home/ContinueProgress'
import type { ProgressValue } from '@/lib/library/progress'
import type { LibraryStatus } from '@/types/library'
import {
  type KIcon,
  IconFilm,
  IconTv,
  IconAnime,
  IconLibrary,
  IconComic,
  IconManga,
  IconGamepad,
} from '@/components/icons'

export interface HeroItem {
  media_id: string
  /** Progreso por formato, de las columnas `progress_*` (null = sin progreso). */
  progress: ProgressValue | null
  /** Por defecto «en progreso» (es lo que pide Inicio para el hero). */
  status?: LibraryStatus
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

/* Mismo mapa de iconos propios que ProfileStats — icono coherente por tipo
   de media en vez de emoji suelto (E78). */
const TYPE_ICONS: Record<string, KIcon> = {
  movie: IconFilm,
  tv: IconTv,
  anime: IconAnime,
  book: IconLibrary,
  comic: IconComic,
  manga: IconManga,
  game: IconGamepad,
}

/* Fórmula F0 del hero (canvas "Kultura Editorial"): gradiente lineal de dos
   tonos + acento radial en la esquina superior-izquierda — misma fórmula
   que "cards feature grandes" en el sistema de diseño, con los valores oklch literales
   del hero real. */
/* Degradados del héroe (fondo, respaldo de la portada y acento radial):
   van como valores arbitrarios idénticos a los que iban en línea (C13). */

export function HeroSection({ item }: HeroSectionProps) {
  const t = useTranslations('home')
  const tMedia = useTranslations('media')

  // Sin título en curso NO hay hero. Antes se pintaba una tarjeta "¿Qué estás
  // viendo?" que ocupaba media pantalla para decir que no había nada: el resto
  // de secciones (continuar, círculo, recomendaciones, novedades) llenan mejor
  // ese espacio, y la llamada a explorar sigue disponible en las tarjetas
  // vacías de esas mismas secciones.
  if (!item?.media) return null

  const { media, progress } = item
  const externalId = media.id.split('_').slice(1).join('_')
  const href = `/media/${media.type}/${externalId}`
  const TypeIcon = TYPE_ICONS[media.type] ?? IconFilm

  // F-27: progreso por formato con «marcar siguiente» en 1 toque.
  const quick = canQuickAdvance(media.type)

  return (
    <section className="relative rounded-bento-xl shadow-hard-sm md:shadow-hard">
      {/* Badge colgante — misma pegatina lime/rotada/sombra dura que el match badge
          de F0, reutilizada aquí con texto real ("Continuando"), no un dato inventado. */}
      <div
        className="absolute -top-3.5 left-6 md:left-9 z-20 rounded-pill px-4 py-2 bg-accent-lime text-on-accent-lime font-display text-xs font-extrabold tracking-wide shadow-sticker -rotate-[6deg]"
      >
        <span aria-hidden="true">▶</span> <span className="uppercase">{t('continuing')}</span>
      </div>

      <div
        className="relative overflow-hidden rounded-bento-xl flex flex-col md:flex-row bg-[linear-gradient(120deg,oklch(38%_0.14_300)_0%,oklch(22%_0.08_280)_100%)]"
      >
        <div className="relative w-full md:w-64 lg:w-80 aspect-[16/9] md:aspect-auto md:self-stretch flex-shrink-0 overflow-hidden rounded-t-bento-xl md:rounded-l-bento-xl md:rounded-tr-none">
          {/* Respaldo SIEMPRE detrás: si la portada falla queda color, no hueco. */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_20%_10%,oklch(55%_0.2_340/0.6)_0%,transparent_55%),linear-gradient(160deg,oklch(30%_0.1_300),oklch(16%_0.06_280))]" />
          {media.poster && (
            <>
              <PosterImage
                src={media.poster}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 320px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </>
          )}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_100%_at_20%_10%,oklch(55%_0.2_340/0.5)_0%,transparent_55%)]" />
        </div>

        <div className="relative flex-1 p-6 md:p-9 flex flex-col justify-center gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary font-body font-bold text-xs px-3 py-1.5">
              <TypeIcon className="w-3.5 h-3.5" />
              {tMedia(media.type as Parameters<typeof tMedia>[0])}
            </span>
            {media.year ? (
              <span className="inline-flex items-center rounded-full bg-surface-elevated text-text-primary font-body font-bold text-xs px-3 py-1.5">
                {media.year}
              </span>
            ) : null}
          </div>

          <h2 className="font-display text-xl md:text-3xl font-extrabold text-text-primary leading-tight">
            {media.title}
          </h2>

          {media.synopsis && (
            <p className="font-body text-sm text-text-secondary line-clamp-2 md:line-clamp-3">
              {media.synopsis}
            </p>
          )}

          {quick && (
            <ContinueProgress
              mediaId={item.media_id}
              mediaType={media.type}
              title={media.title}
              progress={progress}
              status={item.status ?? 'in_progress'}
              variant="hero"
            />
          )}

          <KButton asChild size="lg" className="w-fit mt-1">
            <Link href={href}>{t('continue')}</Link>
          </KButton>
        </div>
      </div>
    </section>
  )
}
