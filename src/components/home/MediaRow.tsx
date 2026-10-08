'use client'

import * as React from 'react'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'

export interface MediaRowItem {
  mediaId: string
  title: string
  poster?: string | null
  type: string
  year?: number
  /** Match score real (F3a). Ausente = sin badge — nunca decorativo. */
}

interface MediaRowProps {
  items: MediaRowItem[]
  title: string
  emptyIcon?: string
  emptyMessage?: string
  emptyHint?: string
  emptyAction?: { label: string; href: string }
  isLoading?: boolean
  /**
   * E-SIN-CARDS-VACIAS: sin portada (o si falla al cargar) la card no se
   * enseña. Por defecto SÍ; las filas de la biblioteca del usuario (seguir
   * viendo, perfil) pasan `false` y se quedan con gradiente + título.
   */
  requirePoster?: boolean
}

const SKELETONS = [0, 1, 2, 3, 4]

export function MediaRow({
  items: allItems,
  title,
  emptyIcon,
  emptyMessage,
  emptyHint,
  emptyAction,
  isLoading,
  requirePoster = true,
}: MediaRowProps) {
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set())
  const items = requirePoster ? allItems.filter((i) => i.poster && !failed.has(i.mediaId)) : allItems
  if (!isLoading && items.length === 0 && !emptyMessage) return null

  return (
    <section>
      <h2 className="font-display text-xl font-bold mb-3 text-text-primary">{title}</h2>

      {isLoading && (
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {SKELETONS.map((i) => (
            <div
              key={i}
              className="w-28 md:w-36 flex-shrink-0 animate-pulse bg-surface-elevated rounded-bento aspect-[2/3]"
            />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && emptyMessage && (
        <div className="bg-surface-default border border-surface-border rounded-bento p-6 text-center flex flex-col items-center gap-3">
          {emptyIcon && <span className="text-3xl">{emptyIcon}</span>}
          <p className="font-body text-sm font-medium text-text-primary">{emptyMessage}</p>
          {emptyHint && <p className="font-body text-xs text-text-tertiary">{emptyHint}</p>}
          {emptyAction && (
            <KButton asChild size="sm">
              <Link href={emptyAction.href}>{emptyAction.label}</Link>
            </KButton>
          )}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((item) => {
            const externalId = item.mediaId.split('_').slice(1).join('_')
            const href = `/media/${item.type}/${externalId}`
            return (
              <Link
                key={item.mediaId}
                href={href}
                className="w-28 md:w-36 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative aspect-[2/3] rounded-bento overflow-hidden bg-surface-elevated">
                  {/* Respaldo F0 SIEMPRE detrás: un título sin portada o con
                      portada rota se ve como bloque de color con sus
                      iniciales, nunca como un hueco con "◻". */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: posterGradient(item.mediaId || item.title) }}
                  >
                    <span className="font-display text-lg font-extrabold text-white/90">
                      {item.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  {item.poster && (
                    <PosterImage
                      src={item.poster}
                      sizes="(max-width: 768px) 112px, 144px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      onFail={() =>
                        setFailed((prev) => (prev.has(item.mediaId) ? prev : new Set(prev).add(item.mediaId)))
                      }
                    />
                  )}
                </div>
                <p
                  className="font-display text-sm font-bold mt-2 line-clamp-2 text-text-primary leading-tight"
                  title={item.title}
                >
                  {item.title}
                </p>
                {item.year ? (
                  <p className="font-body text-xs text-text-tertiary mt-0.5">{item.year}</p>
                ) : null}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
