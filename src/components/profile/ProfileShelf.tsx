// ============================================================
// KULTURA — ProfileShelf (Server Component)
// Una página del álbum de una persona, de noche: los títulos de UN estado
// con la forma que les da el álbum (DISENO.md, `albumShapeFor`):
//   pendiente  → hueco numerado y discontinuo con el título impreso;
//   en curso   → cromo puesto, con la tira de avance en el color del formato;
//   completado → cromo pegado (brillante si es un 10/10);
//   abandonado → cromo con la esquina doblada, a la vista.
// Bajo cada uno, la banda con su estado y «hace N días» cuando se sabe.
// La fila desliza en el móvil y se pega una vez al montar.
// ============================================================

import { getLocale } from 'next-intl/server'
import { Cromo } from '@/components/album/Cromo'
import { Slot } from '@/components/album/Slot'
import { StatusBand } from '@/components/album/StatusBand'
import { getAlbumLabels } from '@/components/album/labels.server'
import { PasteOnMount } from '@/components/profile/PasteOnMount'
import { Link } from '@/i18n/navigation'
import { albumShapeFor, FORMATS, isFoil } from '@/lib/design/album'
import type { MediaStatus, MediaType } from '@/types/media'

export interface ShelfItem {
  mediaId: string
  title: string
  poster: string | null
  type: string
  /** Nota fina 0,5–10 (brillo en el 10). */
  rating10?: number | null
  /** Avance 0–1 (en curso, si se conoce el total). */
  progress?: number | null
  /** Última vez que se tocó (ISO). */
  updatedAt?: string | null
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring'

const isFormat = (type: string): type is MediaType => (FORMATS as readonly string[]).includes(type)

function href(item: ShelfItem): string {
  return `/media/${item.type}/${item.mediaId.split('_').slice(1).join('_')}`
}

export async function ProfileShelf({
  id,
  title,
  status,
  items,
  priorityCount = 0,
}: {
  id: string
  title: string
  status: MediaStatus
  items: ShelfItem[]
  /** Cuántas portadas cargan con prioridad (solo la primera fila de la página). */
  priorityCount?: number
}) {
  if (items.length === 0) return null
  const locale = await getLocale()
  const album = await getAlbumLabels(locale)
  const shape = albumShapeFor(status)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-2xl text-text-primary">
        {title}
      </h2>
      <PasteOnMount className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide md:-mx-8 md:px-8">
        {items.map((item, i) => {
          const format = isFormat(item.type) ? item.type : undefined
          const band = item.updatedAt ? (
            <StatusBand status={status} label={album.status(status)} touchedAt={item.updatedAt} locale={locale} />
          ) : null
          if (shape === 'slot') {
            return (
              <li key={item.mediaId} className="w-28 shrink-0 snap-start md:w-36">
                <Link href={href(item)} className={`group block rounded-cromo ${FOCUS}`}>
                  <Slot
                    number={i + 1}
                    title={item.title}
                    format={format}
                    formatLabel={format ? album.format(format) : undefined}
                    label={album.slotPending(i + 1)}
                    band={band}
                  />
                </Link>
              </li>
            )
          }
          const progress = shape === 'placed' && typeof item.progress === 'number' ? item.progress : undefined
          const foil = shape === 'pasted' && isFoil(item.rating10)
          return (
            <li key={item.mediaId} className="w-28 shrink-0 snap-start md:w-36">
              <Link href={href(item)} className={`group block rounded-cromo ${FOCUS}`}>
                <Cromo
                  seed={item.mediaId}
                  title={item.title}
                  poster={item.poster}
                  sizes="(max-width: 768px) 112px, 144px"
                  priority={i < priorityCount}
                  state={shape}
                  format={format}
                  progress={progress}
                  progressLabel={progress === undefined ? undefined : album.progressPercent(percent.format(progress))}
                  foil={foil}
                  stateLabel={foil ? album.foil() : shape === 'folded' ? album.folded() : undefined}
                />
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-text-primary" title={item.title}>
                  {item.title}
                </h3>
              </Link>
              {band ? <div className="mt-1.5">{band}</div> : null}
            </li>
          )
        })}
      </PasteOnMount>
    </section>
  )
}
