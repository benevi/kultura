// ============================================================
// KULTURA — Títulos de una lista pública EN SU ORDEN (F-25, PRO-10)
//
// Componente de servidor. Lista numerada (`<ol>`) en el orden que eligió el
// dueño; en un «Ranking personal» el número también se pinta. Las notas del
// dueño van debajo de cada título. Mismas cards que el resto (`MediaCard`,
// gradiente siempre detrás de la portada).
// ============================================================

import { getTranslations } from 'next-intl/server'
import { MediaCard } from '@/components/media/MediaCard'
import type { MediaItem } from '@/types/media'

export interface OrderedListEntry {
  item: MediaItem
  note: string | null
}

export async function OrderedListGrid({
  entries,
  ranked,
  label,
}: {
  entries: OrderedListEntry[]
  ranked: boolean
  /** Nombre accesible de la lista (el de la propia lista). */
  label: string
}) {
  const t = await getTranslations('lists')
  return (
    <ol aria-label={label} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-5">
      {entries.map(({ item, note }, index) => (
        <li key={item.id} className="relative flex flex-col gap-2">
          {ranked && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-accent-lime px-2 font-display text-sm font-extrabold tabular-nums text-on-accent-lime shadow-[3px_3px_0_rgba(0,0,0,0.4)]"
              >
                {index + 1}
              </span>
              <span className="sr-only">{t('rankPosition', { position: index + 1 })}</span>
            </>
          )}
          {/* h2: los títulos van justo bajo el h1 de la lista (ACC-7). */}
          <MediaCard item={item} priority={index < 6} headingLevel={2} />
          {note ? (
            <p className="text-[13px] leading-snug text-text-secondary whitespace-pre-line break-words">
              <span className="sr-only">{t('noteFor', { title: item.title })}: </span>
              {note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
