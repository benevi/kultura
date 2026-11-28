// ============================================================
// KULTURA — Ordenar y anotar de hoy: HTML (caracterización, fase 8.5 L4).
//
// Fija lo que pintan hoy `ReorderableItems` (asa, número, póster, Subir y
// Bajar, cogido con teclado, guardando y error) e `ItemNote` (nota a la
// vista, editor y error) para que sacar su estado a hooks
// (`useReorderableItems`, `useItemNote`) y la versión de «Sala» (solo con
// `SALA_LISTAS`) los dejen EXACTAMENTE igual. Se sacó antes de tocarlos.
// ============================================================

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { ReorderableItems, SAVE_DELAY_MS } from '@/app/[locale]/(app)/lists/[id]/ReorderableItems'
import { ItemNote } from '@/app/[locale]/(app)/lists/[id]/ItemNote'
import type { ListItem } from '@/types/list'

const LIST = 'list-1'
const mk = (id: string, title: string, note: string | null = null): ListItem => ({
  id, listId: LIST, mediaId: `book_${id}`, addedAt: '2026-01-01', position: null, note,
  media: { id: `book_${id}`, externalId: id, type: 'book', title },
})
const INITIAL = [mk('a', 'Dune', 'Empieza aquí'), mk('b', 'El mesías de Dune')]

function Harness({ ranked }: { ranked: boolean }) {
  const [items, setItems] = useState(INITIAL)
  return <ReorderableItems listId={LIST} items={items} onItemsChange={setItems} ranked={ranked} />
}

function html(container: HTMLElement) {
  return container.innerHTML.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, 'ID')
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

describe('ReorderableItems (sin «Sala»): marcado de hoy', () => {
  it('ranking y lista libre', () => {
    const a = render(<Harness ranked />)
    expect(html(a.container)).toMatchSnapshot()
    a.unmount()
    const b = render(<Harness ranked={false} />)
    expect(html(b.container)).toMatchSnapshot()
  })

  it('cogido con teclado y movido (guardando)', () => {
    const { container } = render(<Harness ranked />)
    const asa = screen.getAllByRole('button', { name: /lists\.dragHandle/ })[0]
    fireEvent.keyDown(asa, { key: ' ' })
    fireEvent.keyDown(asa, { key: 'ArrowDown' })
    expect(html(container)).toMatchSnapshot()
    fireEvent.keyDown(screen.getAllByRole('button', { name: /lists\.dragHandle/ })[1], { key: ' ' })
    expect(html(container)).toMatchSnapshot()
  })

  it('si falla el guardado: vuelve y avisa', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'internal' } }), { status: 500 }))
    const { container } = render(<Harness ranked />)
    fireEvent.click(screen.getAllByRole('button', { name: /lists\.moveDown/ })[0])
    await act(async () => {
      vi.advanceTimersByTime(SAVE_DELAY_MS + 10)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(html(container)).toMatchSnapshot()
  })
})

describe('ItemNote (sin «Sala»): marcado de hoy', () => {
  it('a la vista, editable y no editable', () => {
    const a = render(<ItemNote listId={LIST} item={INITIAL[0]} editable onSaved={vi.fn()} />)
    expect(html(a.container)).toMatchSnapshot()
    a.unmount()
    const b = render(<ItemNote listId={LIST} item={INITIAL[0]} editable={false} onSaved={vi.fn()} />)
    expect(html(b.container)).toMatchSnapshot()
    b.unmount()
    const c = render(<ItemNote listId={LIST} item={INITIAL[1]} editable={false} onSaved={vi.fn()} />)
    expect(c.container.innerHTML).toBe('')
  })

  it('editor y error', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'internal' } }), { status: 500 }))
    const { container } = render(<ItemNote listId={LIST} item={INITIAL[1]} editable onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /lists\.addNoteNamed/ }))
    expect(html(container)).toMatchSnapshot()
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(html(container)).toMatchSnapshot()
  })
})
