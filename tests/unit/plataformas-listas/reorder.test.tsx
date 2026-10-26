// ============================================================
// F-25 (PRO-10) — Ordenar una lista: teclado (coger/mover/soltar/cancelar),
// botones Subir/Bajar, arrastre con puntero, guardado en UNA petición con el
// orden completo y vuelta atrás si falla. Notas en línea.
// ============================================================

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { ReorderableItems, SAVE_DELAY_MS, moveItem } from '@/app/[locale]/(app)/lists/[id]/ReorderableItems'
import { ItemNote } from '@/app/[locale]/(app)/lists/[id]/ItemNote'
import type { ListItem } from '@/types/list'

const LIST = 'list-1'
const mk = (id: string, title: string): ListItem => ({
  id, listId: LIST, mediaId: `book_${id}`, addedAt: '2026-01-01', position: null, note: null,
  media: { id: `book_${id}`, externalId: id, type: 'book', title },
})
const INITIAL = [mk('a', 'Dune'), mk('b', 'El mesías de Dune'), mk('c', 'Hijos de Dune')]

function Harness({ initial = INITIAL }: { initial?: ListItem[] }) {
  const [items, setItems] = useState(initial)
  return (
    <>
      <ReorderableItems listId={LIST} items={items} onItemsChange={setItems} ranked />
      <div data-testid="order">{items.map((i) => i.id).join(',')}</div>
    </>
  )
}

const fetchMock = vi.fn()
const order = () => screen.getByTestId('order').textContent
const handle = (title: string) => screen.getByRole('button', { name: new RegExp(`lists\\.dragHandle.*"title":"${title}"`) })
const bodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body))

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.useRealTimers())

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 20)
  })
}

describe('moveItem', () => {
  it('mueve sin mutar', () => {
    const src = [1, 2, 3, 4]
    expect(moveItem(src, 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveItem(src, 3, 0)).toEqual([4, 1, 2, 3])
    expect(src).toEqual([1, 2, 3, 4])
  })
})

describe('ReorderableItems — teclado', () => {
  it('Espacio coge, flechas mueven, Espacio suelta: UNA petición con el orden completo', async () => {
    render(<Harness />)
    const h = handle('Dune')
    h.focus()
    fireEvent.keyDown(h, { key: ' ' })
    expect(h).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('lists.grabbed')
    fireEvent.keyDown(h, { key: 'ArrowDown' })
    fireEvent.keyDown(h, { key: 'ArrowDown' })
    expect(order()).toBe('b,c,a')
    expect(screen.getByRole('status')).toHaveTextContent('"position":3,"total":3')
    // El foco sigue en el asa del título movido.
    expect(document.activeElement).toBe(handle('Dune'))
    // Mientras está cogido no se guarda nada.
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.keyDown(handle('Dune'), { key: ' ' })
    expect(screen.getByRole('status')).toHaveTextContent('lists.dropped')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/lists/${LIST}`)
    expect(bodies()[0]).toEqual({ order: ['b', 'c', 'a'] })
  })

  it('Escape devuelve el título a su sitio y no guarda', async () => {
    render(<Harness />)
    const h = handle('Hijos de Dune')
    h.focus()
    fireEvent.keyDown(h, { key: 'Enter' })
    fireEvent.keyDown(h, { key: 'Home' })
    expect(order()).toBe('c,a,b')
    fireEvent.keyDown(handle('Hijos de Dune'), { key: 'Escape' })
    expect(order()).toBe('a,b,c')
    expect(screen.getByRole('status')).toHaveTextContent('lists.dragCancelled')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('las flechas sin coger no mueven nada', () => {
    render(<Harness />)
    fireEvent.keyDown(handle('Dune'), { key: 'ArrowDown' })
    expect(order()).toBe('a,b,c')
  })
})

describe('ReorderableItems — botones y guardado', () => {
  it('Subir/Bajar con nombre; extremos deshabilitados; varios clics = una petición', async () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /lists\.moveUp.*"title":"Dune"/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /lists\.moveDown.*"title":"Hijos de Dune"/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /lists\.moveDown.*"title":"Dune"/ }))
    fireEvent.click(screen.getByRole('button', { name: /lists\.moveDown.*"title":"Dune"/ }))
    expect(order()).toBe('b,c,a')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bodies()[0]).toEqual({ order: ['b', 'c', 'a'] })
  })

  it('si el guardado falla, vuelve al último orden guardado y lo avisa', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /lists\.moveUp.*"title":"Hijos de Dune"/ }))
    expect(order()).toBe('a,c,b')
    await settle()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(order()).toBe('a,b,c')
    expect(screen.getByRole('alert')).toHaveTextContent('lists.orderError')
  })

  it('arrastre con puntero: suelta y guarda el nuevo orden', async () => {
    render(<Harness />)
    const rows = screen.getAllByRole('listitem')
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 100, height: 100, bottom: i * 100 + 100, left: 0, right: 0, width: 0, x: 0, y: i * 100, toJSON: () => ({}) })
    })
    const h = handle('Dune')
    fireEvent.pointerDown(h, { pointerId: 1, button: 0, pointerType: 'mouse', clientY: 50 })
    fireEvent.pointerMove(h, { pointerId: 1, pointerType: 'mouse', clientY: 260 })
    fireEvent.pointerUp(h, { pointerId: 1, pointerType: 'mouse', clientY: 260 })
    expect(order()).toBe('b,c,a')
    await settle()
    expect(bodies()[0]).toEqual({ order: ['b', 'c', 'a'] })
  })
})

describe('ItemNote', () => {
  beforeEach(() => vi.useRealTimers())

  it('añadir: campo con etiqueta, guarda recortado y vuelve con la nota visible', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, note: 'Empieza aquí' }) })
    const onSaved = vi.fn()
    render(<ItemNote listId={LIST} item={mk('a', 'Dune')} editable onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: /lists\.addNoteNamed/ }))
    const field = screen.getByRole('textbox', { name: /lists\.noteLabel/ })
    fireEvent.change(field, { target: { value: '  Empieza aquí ' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.noteSave' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Empieza aquí'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ itemId: 'a', note: '  Empieza aquí ' })
  })

  it('fallo: se anuncia y el texto escrito se queda', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(<ItemNote listId={LIST} item={mk('a', 'Dune')} editable onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /lists\.addNoteNamed/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /lists\.noteLabel/ }), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'lists.noteSave' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('lists.noteError'))
    expect(screen.getByRole('textbox', { name: /lists\.noteLabel/ })).toHaveValue('hola')
  })

  it('solo lectura: se ve la nota, sin botón', () => {
    render(<ItemNote listId={LIST} item={{ ...mk('a', 'Dune'), note: 'Clásico' }} editable={false} onSaved={vi.fn()} />)
    expect(screen.getByText('Clásico')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
