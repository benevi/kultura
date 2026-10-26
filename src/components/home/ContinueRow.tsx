'use client'

// ============================================================
// KULTURA — «Continúa donde lo dejaste» con progreso (F-27, PRO-5)
// La fila de Inicio de lo que estás viendo, leyendo o jugando (y lo
// pendiente), como MediaRow, pero cada tarjeta lleva su progreso por formato
// y un botón para marcar lo siguiente en 1 toque: libro con su %, juego con
// sus horas, serie con «T2 · E5». El botón va FUERA del enlace de la tarjeta
// (un botón dentro de un enlace no es HTML válido ni se anuncia bien).
// ============================================================

import * as React from 'react'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { Link } from '@/i18n/navigation'
import { ContinueProgress, canQuickAdvance } from '@/components/home/ContinueProgress'
import { progressFromJson } from '@/lib/library/progress'
import type { LibraryStatus } from '@/types/library'

export interface ContinueRowItem {
  mediaId: string
  title: string
  poster?: string | null
  type: string
  status: LibraryStatus
  /** jsonb `episode_progress` (forma antigua o espejo de las columnas). */
  progress: unknown
}

interface ContinueRowProps {
  title: string
  items: ContinueRowItem[]
  /** PROGRESS_V2: todos los formatos; si no, solo series y anime. */
  fullProgress?: boolean
}

export function ContinueRow({ title, items, fullProgress = false }: ContinueRowProps) {
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="font-display text-xl font-bold mb-3 text-text-primary">{title}</h2>
      <ul className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide" role="list">
        {items.map((item) => {
          const externalId = item.mediaId.split('_').slice(1).join('_')
          const href = `/media/${item.type}/${externalId}`
          const quick = canQuickAdvance(item.type, fullProgress)
          return (
            <li key={item.mediaId} className="w-28 md:w-36 flex-shrink-0">
              <Link href={href} className="group block cursor-pointer">
                <div className="relative aspect-[2/3] rounded-bento overflow-hidden bg-surface-elevated">
                  {/* Respaldo SIEMPRE detrás: sin portada, bloque de color con iniciales. */}
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
                      className="object-cover motion-safe:group-hover:scale-105 motion-safe:transition-transform motion-safe:duration-300"
                    />
                  )}
                </div>
                <p
                  className="font-display text-sm font-bold mt-2 line-clamp-2 text-text-primary leading-tight"
                  title={item.title}
                >
                  {item.title}
                </p>
              </Link>
              {quick && (
                <ContinueProgress
                  mediaId={item.mediaId}
                  mediaType={item.type}
                  title={item.title}
                  progress={progressFromJson(item.progress)}
                  status={item.status}
                  variant="card"
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
