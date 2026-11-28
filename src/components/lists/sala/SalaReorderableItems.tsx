'use client'

// ============================================================
// KULTURA — Ordenar y anotar una lista en «Sala» (fase 8.5 L4)
// El comportamiento es el de `ReorderableItems` (`useReorderableItems`):
// arrastrar el asa (ratón, lápiz o dedo), teclado sobre el asa (Espacio
// coge, flechas mueven, Espacio suelta, Escape cancela) y «Subir» y «Bajar».
// Cada movimiento se anuncia y el orden se guarda en una petición; si falla,
// vuelve y se avisa. Aquí cambia la vista:
//
// - Filas planas separadas por una línea, con el asa, el puesto, el póster
//   (desde `sm`: en un móvil de 320 px no deja sitio al título), el título y
//   «Subir» y «Bajar» de 48 px. La fila cogida o arrastrada se marca con el
//   panel y un borde de tinta, no solo con color.
// - La nota de cada título debajo (`SalaItemNote`).
// - «Guardando el orden…» y «Orden guardado» a la vista; el error, en un
//   `SalaNotice` (se anuncia).
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { SalaPoster } from '@/components/sala/SalaPoster'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'
import { titleOf, useReorderableItems } from '@/app/[locale]/(app)/lists/[id]/useReorderableItems'
import { SalaItemNote } from './SalaItemNote'

interface SalaReorderableItemsProps {
  listId: string
  items: ListItem[]
  onItemsChange: (items: ListItem[]) => void
  /** Ranking personal: el puesto, en tinta (si no, en gris). */
  ranked: boolean
}

export function SalaReorderableItems({ listId, items, onItemsChange, ranked }: SalaReorderableItemsProps) {
  const t = useTranslations('lists')
  const instructionsId = useId()
  const r = useReorderableItems({ listId, items, onItemsChange })

  return (
    <div data-sala-reorder="" className="flex flex-col gap-3">
      <p id={instructionsId} className="max-w-2xl sala-type-small text-sala-ink-secondary">
        {t('reorderHint')}
      </p>

      <ol role="list" aria-label={t('itemsTitle')} className="flex list-none flex-col border-t border-sala-border">
        {items.map((item, index) => {
          const title = titleOf(item)
          const marked = r.grabbedId === item.id || r.draggingId === item.id
          return (
            <li
              key={item.id}
              ref={r.rowRef(item.id)}
              data-sala-reorder-item={item.id}
              className={cn(
                'flex flex-col gap-2 border-b border-sala-border px-2 py-3',
                marked && 'bg-sala-panel outline outline-2 -outline-offset-2 outline-sala-ink'
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  aria-label={t('dragHandle', { title, position: index + 1, total: r.total })}
                  aria-describedby={instructionsId}
                  aria-pressed={r.grabbedId === item.id}
                  onKeyDown={(e) => r.onHandleKeyDown(e, item)}
                  onPointerDown={(e) => r.onPointerDown(e, item)}
                  onPointerMove={(e) => r.onPointerMove(e, item)}
                  onPointerUp={(e) => r.onPointerEnd(e, item)}
                  onPointerCancel={(e) => r.onPointerEnd(e, item)}
                  onBlur={() => r.onHandleBlur(item)}
                  ref={r.controlRef(`${item.id}:handle`)}
                  className={cn(
                    'flex h-sala-target w-sala-target shrink-0 touch-none select-none items-center justify-center text-sala-ink',
                    'sala-hover:bg-sala-panel sala-focused:sala-focus',
                    r.draggingId === item.id ? 'cursor-grabbing' : 'cursor-grab'
                  )}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor">
                    <rect x="3" y="2" width="3" height="3" /><rect x="10" y="2" width="3" height="3" />
                    <rect x="3" y="6.5" width="3" height="3" /><rect x="10" y="6.5" width="3" height="3" />
                    <rect x="3" y="11" width="3" height="3" /><rect x="10" y="11" width="3" height="3" />
                  </svg>
                </button>

                <span
                  aria-hidden="true"
                  className={cn('w-7 shrink-0 text-center sala-type-data tabular-nums', ranked ? 'text-sala-ink' : 'text-sala-ink-secondary')}
                >
                  {index + 1}
                </span>

                <div className="hidden w-10 shrink-0 sm:block">
                  <SalaPoster src={item.media?.poster} alt="" title={title} ratio="2/3" sizes="40px" fallback="plain" />
                </div>

                <span className="min-w-0 flex-1 sala-type-label line-clamp-2 [overflow-wrap:anywhere]">{title}</span>

                <div className="flex shrink-0 items-center gap-1">
                  <SalaButton
                    variant="secondary"
                    ref={r.controlRef(`${item.id}:up`)}
                    icon={<FlechaIcon arriba />}
                    label={t('moveUp', { title })}
                    disabled={index === 0}
                    onClick={() => r.step(item, -1)}
                  />
                  <SalaButton
                    variant="secondary"
                    ref={r.controlRef(`${item.id}:down`)}
                    icon={<FlechaIcon />}
                    label={t('moveDown', { title })}
                    disabled={index === r.total - 1}
                    onClick={() => r.step(item, 1)}
                  />
                </div>
              </div>

              <SalaItemNote
                listId={listId}
                item={item}
                editable
                onSaved={(note) => r.noteSaved(item.id, note)}
              />
            </li>
          )
        })}
      </ol>

      <p role="status" className="sr-only">
        {r.announcement}
      </p>
      <p aria-hidden="true" className="min-h-5 sala-type-small text-sala-ink-secondary">
        {r.saveState === 'saving' ? t('orderSaving') : r.saveState === 'saved' ? t('orderSaved') : ''}
      </p>
      {r.saveState === 'error' ? <SalaNotice tone="error">{t('orderError')}</SalaNotice> : null}
    </div>
  )
}

function FlechaIcon({ arriba = false }: { arriba?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      aria-hidden="true"
      className={cn('h-5 w-5', arriba && 'rotate-180')}
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}
