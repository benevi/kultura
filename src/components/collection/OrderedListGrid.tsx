// ============================================================
// KULTURA — Títulos de una lista pública EN SU ORDEN (F-25, PRO-10)
//
// Componente de servidor. La lista es una página del álbum: una rejilla de
// cromos (`<ol>`, en el orden que eligió el dueño) que se pegan uno detrás
// de otro la primera vez que entran en pantalla. En un «Ranking personal»
// cada cromo lleva su número en la caja amarilla del álbum. Las notas del
// dueño van debajo de cada título; el formato, con su nombre, en las listas
// de varios formatos. Respaldo de color SIEMPRE detrás de la portada.
// ============================================================

import { getTranslations } from 'next-intl/server'
import { Cromo } from '@/components/album/Cromo'
import { FormatTag } from '@/components/album/FormatTag'
import { NumberBadge } from '@/components/album/NumberBadge'
import { getAlbumLabels } from '@/components/album/labels.server'
import { PasteOnEnter } from '@/components/collection/PasteOnEnter'
import { Link } from '@/i18n/navigation'
import type { MediaItem } from '@/types/media'

export interface OrderedListEntry {
  item: MediaItem
  note: string | null
}

/** Portadas que cargan con prioridad: la primera fila en cualquier ancho. */
const PRIORITY = 6

export async function OrderedListGrid({
  entries,
  ranked,
  label,
  showFormat = false,
}: {
  entries: OrderedListEntry[]
  ranked: boolean
  /** Nombre accesible de la lista (el de la propia lista). */
  label: string
  /** Lista de varios formatos: cada título dice el suyo. */
  showFormat?: boolean
}) {
  const [t, album] = await Promise.all([getTranslations('lists'), getAlbumLabels()])
  return (
    <PasteOnEnter
      as="ol"
      aria-label={label}
      className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6"
    >
      {entries.map(({ item, note }, index) => (
        <li key={item.id} className="relative flex min-w-0 flex-col">
          <Link
            href={`/media/${item.type}/${item.externalId}`}
            className="group block rounded-cromo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
          >
            <div className="relative">
              <Cromo
                seed={item.id}
                title={item.title}
                poster={item.poster}
                sizes="(max-width: 640px) 31vw, (max-width: 1024px) 22vw, 180px"
                priority={index < PRIORITY}
                format={item.type}
              />
              {ranked ? (
                <NumberBadge
                  n={index + 1}
                  tone="yellow"
                  size="sm"
                  label={t('rankPosition', { position: index + 1 })}
                  className="absolute -left-1.5 -top-1.5 z-[2] border-2 border-album-navy"
                />
              ) : null}
            </div>
            {/* h2: los títulos van justo bajo el h1 de la lista (ACC-7). */}
            <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-text-primary" title={item.title}>
              {item.title}
            </h2>
          </Link>
          {showFormat || item.year ? (
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
              {showFormat ? <FormatTag format={item.type} label={album.format(item.type)} /> : null}
              {item.year ? <span className="tabular-nums">{item.year}</span> : null}
            </p>
          ) : null}
          {note ? (
            <p className="mt-2 whitespace-pre-line break-words text-meta leading-snug text-text-secondary">
              <span className="sr-only">{t('noteFor', { title: item.title })}: </span>
              {note}
            </p>
          ) : null}
        </li>
      ))}
    </PasteOnEnter>
  )
}
