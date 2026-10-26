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

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { PosterImage } from '@/components/media/PosterImage'
import { IconChevronDown, IconChevronUp } from '@/components/icons'
import { posterGradient } from '@/lib/images/poster-gradient'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'
import { ItemNote } from './ItemNote'

/** Pausa antes de guardar: varias flechas seguidas = una sola petición. */
export const SAVE_DELAY_MS = 600

interface ReorderableItemsProps {
  listId: string
  items: ListItem[]
  onItemsChange: (items: ListItem[]) => void
  /** Ranking personal: número visible delante de cada título. */
  ranked: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

function titleOf(item: ListItem): string {
  return item.media?.title ?? item.mediaId
}

export function ReorderableItems({ listId, items, onItemsChange, ranked }: ReorderableItemsProps) {
  const t = useTranslations('lists')
  const instructionsId = useId()
  const [announcement, setAnnouncement] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Último orden que la base tiene confirmado (para deshacer si falla).
  const savedRef = useRef<ListItem[]>(items)
  const pendingRef = useRef<ListItem[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Orden al coger con teclado (Escape lo restaura).
  const grabStartRef = useRef<ListItem[] | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  // Asas y botones por `${id}:handle|up|down`: al reordenar, React puede
  // mover en el DOM justo el nodo que tiene el foco (y el navegador lo
  // pierde); se devuelve al mismo control en cuanto se pinta.
  const controlRefs = useRef(new Map<string, HTMLElement>())
  const refocusRef = useRef<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useLayoutEffect(() => {
    const key = refocusRef.current
    if (!key) return
    refocusRef.current = null
    const el = controlRefs.current.get(key)
    if (el && document.activeElement !== el) el.focus()
  }, [items])

  const controlRef = (key: string) => (el: HTMLElement | null) => {
    if (el) controlRefs.current.set(key, el)
    else controlRefs.current.delete(key)
  }

  const total = items.length

  const flush = useCallback(async () => {
    const order = pendingRef.current
    pendingRef.current = null
    timerRef.current = null
    if (!order) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: order.map((i) => i.id) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      savedRef.current = order
      // Si entretanto hubo otro movimiento, ese ya tiene su temporizador.
      if (!pendingRef.current) setSaveState('saved')
    } catch {
      pendingRef.current = null
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      onItemsChange(savedRef.current)
      // El aviso lo da el `role="alert"` de abajo (no se duplica en status).
      setSaveState('error')
    }
  }, [listId, onItemsChange])

  const scheduleSave = useCallback(
    (next: ListItem[]) => {
      pendingRef.current = next
      setSaveState('saving')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush]
  )

  // Al salir del modo ordenar (desmontar), lo pendiente se guarda ya.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        void flush()
      }
    },
    [flush]
  )

  function apply(next: ListItem[], save: boolean) {
    onItemsChange(next)
    if (save) scheduleSave(next)
  }

  function announceAt(key: 'moved' | 'grabbed' | 'dropped', item: ListItem, list: ListItem[]) {
    const position = list.findIndex((i) => i.id === item.id) + 1
    setAnnouncement(t(key, { title: titleOf(item), position, total: list.length }))
  }

  // ── Botones Subir / Bajar ─────────────────────────────────────────────────
  function step(item: ListItem, delta: number) {
    const list = itemsRef.current
    const from = list.findIndex((i) => i.id === item.id)
    const to = from + delta
    if (from === -1 || to < 0 || to >= list.length) return
    const next = moveItem(list, from, to)
    // El foco se queda en el mismo botón; en un extremo (deshabilitado), en el otro.
    const edge = delta < 0 ? to === 0 : to === list.length - 1
    refocusRef.current = `${item.id}:${edge ? (delta < 0 ? 'down' : 'up') : delta < 0 ? 'up' : 'down'}`
    apply(next, true)
    announceAt('moved', item, next)
  }

  function drop(item: ListItem) {
    const list = itemsRef.current
    setGrabbedId(null)
    grabStartRef.current = null
    announceAt('dropped', item, list)
    if (savedRef.current.map((i) => i.id).join() !== list.map((i) => i.id).join()) scheduleSave(list)
  }

  // ── Teclado sobre el asa ──────────────────────────────────────────────────
  function onHandleKeyDown(e: React.KeyboardEvent, item: ListItem) {
    const list = itemsRef.current
    const index = list.findIndex((i) => i.id === item.id)
    const grabbed = grabbedId === item.id

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!grabbed) {
        grabStartRef.current = list
        setGrabbedId(item.id)
        announceAt('grabbed', item, list)
      } else {
        drop(item)
      }
      return
    }
    if (!grabbed) return

    let to = index
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = index - 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = index + 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = list.length - 1
    else if (e.key === 'Tab') {
      // Salir con Tab suelta donde está (no se pierde lo movido).
      drop(item)
      return
    } else if (e.key === 'Escape') {
      e.preventDefault()
      refocusRef.current = `${item.id}:handle`
      const start = grabStartRef.current ?? list
      setGrabbedId(null)
      grabStartRef.current = null
      onItemsChange(start)
      const position = start.findIndex((i) => i.id === item.id) + 1
      setAnnouncement(t('dragCancelled', { title: titleOf(item), position }))
      return
    } else return

    e.preventDefault()
    if (to < 0 || to >= list.length || to === index) return
    const next = moveItem(list, index, to)
    refocusRef.current = `${item.id}:handle`
    apply(next, false)
    announceAt('moved', item, next)
  }

  // ── Arrastrar con puntero ─────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, item: ListItem) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDraggingId(item.id)
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>, item: ListItem) {
    if (draggingId !== item.id) return
    const list = itemsRef.current
    const from = list.findIndex((i) => i.id === item.id)
    // Destino: la primera fila cuya mitad queda por debajo del puntero.
    let to = list.length - 1
    for (let i = 0; i < list.length; i++) {
      const rect = rowRefs.current.get(list[i].id)?.getBoundingClientRect()
      if (rect && e.clientY < rect.top + rect.height / 2) {
        to = i > from ? i - 1 : i
        break
      }
    }
    if (to !== from) apply(moveItem(list, from, to), false)
  }

  function onPointerEnd(e: React.PointerEvent<HTMLButtonElement>, item: ListItem) {
    if (draggingId !== item.id) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setDraggingId(null)
    const list = itemsRef.current
    if (savedRef.current.map((i) => i.id).join() !== list.map((i) => i.id).join()) {
      scheduleSave(list)
      announceAt('dropped', item, list)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p id={instructionsId} className="text-[13px] text-text-tertiary">{t('reorderHint')}</p>

      <ol className="flex flex-col gap-2" aria-label={t('itemsTitle')}>
        {items.map((item, index) => {
          const title = titleOf(item)
          const grabbed = grabbedId === item.id
          const dragging = draggingId === item.id
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el)
                else rowRefs.current.delete(item.id)
              }}
              className={cn(
                'flex flex-col gap-2 rounded-20 bg-surface-default px-3 py-3 sm:px-4 transition-shadow',
                (grabbed || dragging) && 'ring-2 ring-accent-pink shadow-lg'
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
                  onBlur={() => {
                    if (grabbedId !== item.id) return
                    // Un clic fuera suelta (y guarda). El foco que se va solo
                    // porque React movió el nodo vuelve antes de este tick.
                    setTimeout(() => {
                      if (document.activeElement !== controlRefs.current.get(`${item.id}:handle`)) drop(item)
                    }, 0)
                  }}
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

                <div
                  className="relative h-[60px] w-10 flex-shrink-0 overflow-hidden rounded-md"
                  style={{ background: posterGradient(item.mediaId) }}
                >
                  {item.media?.poster ? <PosterImage src={item.media.poster} sizes="40px" /> : null}
                </div>

                <span className="min-w-0 flex-1 font-display text-[15px] font-bold leading-tight text-text-primary line-clamp-2">
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
                onSaved={(note) =>
                  onItemsChange(itemsRef.current.map((i) => (i.id === item.id ? { ...i, note } : i)))
                }
              />
            </li>
          )
        })}
      </ol>

      <p role="status" className="sr-only">{announcement}</p>
      <p aria-hidden="true" className="min-h-5 text-[13px] text-text-tertiary">
        {saveState === 'saving' ? t('orderSaving') : saveState === 'saved' ? t('orderSaved') : ''}
      </p>
      {saveState === 'error' && (
        <p role="alert" className="text-sm text-accent-danger">{t('orderError')}</p>
      )}
    </div>
  )
}
