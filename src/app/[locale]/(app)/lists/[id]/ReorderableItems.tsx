'use client'

// ============================================================
// KULTURA — Ordenar una lista (F-25, PRO-10)
//
// Tres maneras de mover un título, todas con el mismo resultado:
//  - Arrastrar el asa con ratón, lápiz o dedo (Pointer Events: funciona en
//    táctil, a diferencia del drag & drop de HTML).
//  - Teclado sobre el asa (patrón de "cogida" de WAI-ARIA): Espacio o Intro
//    coge el título, las flechas lo mueven (Inicio/Fin a los extremos),
//    Espacio o Intro lo suelta y Escape lo devuelve a su sitio.
//  - Botones «Subir» y «Bajar» (lector de pantalla, control por voz, o quien
//    no quiera arrastrar).
// Cada cambio se anuncia en una región `status` y se guarda (con una pausa
// corta para agrupar varios movimientos) en UNA petición con el orden
// completo. Si falla, se vuelve al último orden guardado y se avisa.
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { PosterFrame } from '@/components/media/PosterFrame'
import { IconChevronDown, IconChevronUp } from '@/components/icons'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'
import { ItemNote } from './ItemNote'
import { titleOf, useReorderableItems } from './useReorderableItems'

// El estado y las llamadas viven en `useReorderableItems` (lo comparte la
// vista de «Sala»); aquí, solo la vista de hoy.
export { SAVE_DELAY_MS, moveItem } from './useReorderableItems'

interface ReorderableItemsProps {
  listId: string
  items: ListItem[]
  onItemsChange: (items: ListItem[]) => void
  /** Ranking personal: número visible delante de cada título. */
  ranked: boolean
}

export function ReorderableItems({ listId, items, onItemsChange, ranked }: ReorderableItemsProps) {
  const t = useTranslations('lists')
  const instructionsId = useId()
  const {
    total,
    announcement,
    saveState,
    grabbedId,
    draggingId,
    controlRef,
    rowRef,
    step,
    onHandleKeyDown,
    onHandleBlur,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    noteSaved,
  } = useReorderableItems({ listId, items, onItemsChange })

  return (
    <div className="flex flex-col gap-3">
      <p id={instructionsId} className="text-meta text-text-tertiary">{t('reorderHint')}</p>

      <ol className="flex flex-col gap-2" aria-label={t('itemsTitle')}>
        {items.map((item, index) => {
          const title = titleOf(item)
          const grabbed = grabbedId === item.id
          const dragging = draggingId === item.id
          return (
            <li
              key={item.id}
              ref={rowRef(item.id)}
              className={cn(
                'flex flex-col gap-2 rounded-bento bg-surface-default px-3 py-3 sm:px-4 transition-shadow',
                (grabbed || dragging) && 'ring-2 ring-accent-pink shadow-soft'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t('dragHandle', { title, position: index + 1, total })}
                  aria-describedby={instructionsId}
                  aria-pressed={grabbed}
                  onKeyDown={(e) => onHandleKeyDown(e, item)}
                  onPointerDown={(e) => onPointerDown(e, item)}
                  onPointerMove={(e) => onPointerMove(e, item)}
                  onPointerUp={(e) => onPointerEnd(e, item)}
                  onPointerCancel={(e) => onPointerEnd(e, item)}
                  ref={controlRef(`${item.id}:handle`)}
                  onBlur={() => onHandleBlur(item)}
                  className={cn(
                    'flex h-11 w-11 flex-shrink-0 touch-none select-none items-center justify-center rounded-full text-text-secondary',
                    'hover:bg-surface-elevated hover:text-text-primary',
                    'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                    dragging ? 'cursor-grabbing' : 'cursor-grab'
                  )}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                  </svg>
                </button>

                <span
                  aria-hidden="true"
                  className={cn(
                    'w-7 flex-shrink-0 text-center font-display text-base font-extrabold tabular-nums',
                    ranked ? 'text-accent-lime' : 'text-text-tertiary'
                  )}
                >
                  {index + 1}
                </span>

                <PosterFrame
                  seed={item.mediaId}
                  title={title}
                  poster={item.media?.poster}
                  sizes="40px"
                  radius="sm"
                  initials={false}
                  zoom={false}
                  elevated={false}
                  className="h-[60px] w-10 flex-shrink-0"
                />

                <span className="min-w-0 flex-1 font-display text-body font-bold leading-tight text-text-primary line-clamp-2">
                  {title}
                </span>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <KButton
                    variant="secondary"
                    size="sm"
                    className="h-11 w-11 px-0"
                    ref={controlRef(`${item.id}:up`)}
                    aria-label={t('moveUp', { title })}
                    title={t('moveUp', { title })}
                    disabled={index === 0}
                    onClick={() => step(item, -1)}
                  >
                    <IconChevronUp aria-hidden="true" className="h-4 w-4" />
                  </KButton>
                  <KButton
                    variant="secondary"
                    size="sm"
                    className="h-11 w-11 px-0"
                    ref={controlRef(`${item.id}:down`)}
                    aria-label={t('moveDown', { title })}
                    title={t('moveDown', { title })}
                    disabled={index === total - 1}
                    onClick={() => step(item, 1)}
                  >
                    <IconChevronDown aria-hidden="true" className="h-4 w-4" />
                  </KButton>
                </div>
              </div>

              <ItemNote
                listId={listId}
                item={item}
                editable
                onSaved={(note) => noteSaved(item.id, note)}
              />
            </li>
          )
        })}
      </ol>

      <p role="status" className="sr-only">{announcement}</p>
      <p aria-hidden="true" className="min-h-5 text-meta text-text-tertiary">
        {saveState === 'saving' ? t('orderSaving') : saveState === 'saved' ? t('orderSaved') : ''}
      </p>
      {saveState === 'error' && (
        <p role="alert" className="text-sm text-accent-danger">{t('orderError')}</p>
      )}
    </div>
  )
}
