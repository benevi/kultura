'use client'

// ============================================================
// KULTURA — Ordenar una lista: estado y llamadas (F-25, PRO-10)
//
// La lógica de `ReorderableItems`, sin su vista, para que la de hoy y la de
// «Sala» (`SalaReorderableItems`, fase 8.5 L4) se comporten igual:
//  - Arrastrar el asa con ratón, lápiz o dedo (Pointer Events).
//  - Teclado sobre el asa (patrón de "cogida" de WAI-ARIA): Espacio o Intro
//    coge, las flechas mueven (Inicio/Fin a los extremos), Espacio o Intro
//    suelta y Escape devuelve el título a su sitio.
//  - Botones «Subir» y «Bajar».
// Cada cambio se anuncia (`announcement`, para una región `status`) y se
// guarda con una pausa corta en UNA petición con el orden completo. Si falla,
// se vuelve al último orden guardado (`saveState === 'error'`).
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ListItem } from '@/types/list'
import { reorderListItems } from '@/lib/lists/client'

/** Pausa antes de guardar: varias flechas seguidas = una sola petición. */
export const SAVE_DELAY_MS = 600

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

export function titleOf(item: ListItem): string {
  return item.media?.title ?? item.mediaId
}

interface UseReorderableItemsArgs {
  listId: string
  items: ListItem[]
  onItemsChange: (items: ListItem[]) => void
}

export function useReorderableItems({ listId, items, onItemsChange }: UseReorderableItemsArgs) {
  const t = useTranslations('lists')
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

  const rowRef = (id: string) => (el: HTMLLIElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }

  const flush = useCallback(async () => {
    const order = pendingRef.current
    pendingRef.current = null
    timerRef.current = null
    if (!order) return
    setSaveState('saving')
    try {
      await reorderListItems(listId, order.map((i) => i.id))
      savedRef.current = order
      // Si entretanto hubo otro movimiento, ese ya tiene su temporizador.
      if (!pendingRef.current) setSaveState('saved')
    } catch {
      pendingRef.current = null
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      onItemsChange(savedRef.current)
      // El aviso lo da el `role="alert"` de la vista (no se duplica en status).
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

  function onHandleBlur(item: ListItem) {
    if (grabbedId !== item.id) return
    // Un clic fuera suelta (y guarda). El foco que se va solo porque React
    // movió el nodo vuelve antes de este tick.
    setTimeout(() => {
      if (document.activeElement !== controlRefs.current.get(`${item.id}:handle`)) drop(item)
    }, 0)
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

  /** Guardar una nota editada en la lista que hay ahora. */
  function noteSaved(itemId: string, note: string | null) {
    onItemsChange(itemsRef.current.map((i) => (i.id === itemId ? { ...i, note } : i)))
  }

  return {
    total: items.length,
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
  }
}
