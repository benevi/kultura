// ============================================================
// KULTURA — Ordenar y anotar en «Sala» (fase 8.5 L4): la misma lógica que la
// vista de hoy (`useReorderableItems`): Subir/Bajar mueven y se anuncian,
// el asa coge y mueve con flechas, Escape devuelve; el error se avisa.
// ============================================================

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, v?: Record<string, unknown>) =>
    `${ns}.${key}${v ? `(${Object.values(v).join('|')})` : ''}`,
}))
vi.mock('@/components/sala/SalaPoster', () => ({ SalaPoster: () => null }))

import { SalaReorderableItems } from '@/components/lists/sala/SalaReorderableItems'
import { SAVE_DELAY_MS } from '@/app/[locale]/(app)/lists/[id]/useReorderableItems'
import type { ListItem } from '@/types/list'

const mk = (id: string, title: string): ListItem => ({
  id, listId: 'l1', mediaId: `book_${id}`, addedAt: '', position: null, note: null,
  media: { id: `book_${id}`, externalId: id, type: 'book', title },
})

function Harness() {
  const [items, setItems] = useState([mk('a', 'Dune'), mk('b', 'Mesías'), mk('c', 'Hijos')])
  return (
    <>
      <SalaReorderableItems listId="l1" items={items} onItemsChange={setItems} ranked />
      <output data-testid="order">{items.map((i) => i.id).join(',')}</output>
    </>
  )
}

const fetchMock = vi.fn()
beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const order = () => screen.getByTestId('order').textContent

describe('SalaReorderableItems', () => {
  it('Subir y Bajar mueven, anuncian y guardan una vez', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { moved: 3 } }), { status: 200 }))
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'lists.moveUp(Dune)' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'lists.moveDown(Dune)' }))
    expect(order()).toBe('b,a,c')
    expect(screen.getByText('lists.moved(Dune|2|3)')).toHaveAttribute('role', 'status')
    await act(async () => {
      vi.advanceTimersByTime(SAVE_DELAY_MS + 10)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('el asa: Espacio coge, flechas mueven, Escape devuelve', () => {
    render(<Harness />)
    const asa = screen.getByRole('button', { name: 'lists.dragHandle(Dune|1|3)' })
    fireEvent.keyDown(asa, { key: ' ' })
    expect(asa).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(asa, { key: 'End' })
    expect(order()).toBe('b,c,a')
    fireEvent.keyDown(screen.getByRole('button', { name: /lists\.dragHandle\(Dune/ }), { key: 'Escape' })
    expect(order()).toBe('a,b,c')
  })

  it('si falla el guardado: vuelve y se avisa', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'internal' } }), { status: 500 }))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'lists.moveDown(Dune)' }))
    await act(async () => {
      vi.advanceTimersByTime(SAVE_DELAY_MS + 10)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(order()).toBe('a,b,c')
    expect(screen.getByText('lists.orderError')).toBeTruthy()
  })
})
