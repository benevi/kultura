// ============================================================
// KULTURA — Ficha de una lista en «Sala» (fase 8.5 L3): cabecera (`h1`, datos
// con palabras, «de @…» si no es tuya), visibilidad y borrar solo para el
// dueño, `h2` «Títulos» sin el número pegado, rejilla ordenada (en un ranking
// con el número en el nombre), y quitar un título con «Deshacer».
// ============================================================

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import type { List, ListItem } from '@/types/list'

const { removeListItem } = vi.hoisted(() => ({ removeListItem: vi.fn(async () => null) }))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, v?: Record<string, unknown>) =>
    `${ns}.${key}${v ? `(${Object.values(v).join('|')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/components/sala/SalaPoster', () => ({
  SalaPoster: ({ title }: { title: string }) => <div data-testid="poster">{title}</div>,
}))
vi.mock('@/components/social/ShareLinkButton', () => ({
  ShareLinkButton: ({ path, label }: { path: string; label: string }) => <button data-path={path}>{label}</button>,
}))
vi.mock('@/lib/lists/client', () => ({
  removeListItem,
  updateList: vi.fn(async () => ({})),
  deleteList: vi.fn(async () => null),
  inviteListMember: vi.fn(),
  removeListMember: vi.fn(),
  reorderListItems: vi.fn(),
}))

import { SalaListDetail } from '@/components/lists/sala/SalaListDetail'

const ANA = { id: 'u1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', createdAt: '' }

function list(extra: Partial<List> = {}): List {
  return {
    id: 'l1',
    ownerId: 'u1',
    name: 'Dune',
    mediaType: 'mixed',
    isCollaborative: false,
    isPublic: false,
    createdAt: '2026-01-01',
    description: 'Todo Dune',
    template: 'franchise',
    owner: ANA,
    itemCount: 2,
    ...extra,
  }
}

const ITEMS: ListItem[] = [
  {
    id: 'i1',
    listId: 'l1',
    mediaId: 'book_1',
    addedAt: '',
    position: 0,
    note: 'La primera',
    media: { id: 'book_1', type: 'book', title: 'Dune (libro)', year: 1965, poster: null } as never,
  },
  {
    id: 'i2',
    listId: 'l1',
    mediaId: 'movie_2',
    addedAt: '',
    position: 1,
    note: null,
    media: { id: 'movie_2', type: 'movie', title: 'Dune (2021)', year: 2021, poster: null } as never,
  },
]

const LABELS = { region: 'Avisos', dismiss: 'Cerrar', hint: 'F8' }

function renderDetail(props: Partial<React.ComponentProps<typeof SalaListDetail>> = {}) {
  return render(
    <SalaListDetail
      list={list()}
      items={ITEMS}
      members={[]}
      currentUserId="u1"
      currentUserFriends={[]}
      canEdit
      toastLabels={LABELS}
      {...props}
    />
  )
}

beforeEach(() => {
  removeListItem.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SalaListDetail', () => {
  it('cabecera: `h1`, datos con palabras y en minúscula, descripción', () => {
    renderDetail()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Dune')
    const datos = screen.getByText('lists.mediatypemixed').parentElement!
    expect(datos.textContent).toContain('lists.template.franchise'.toLocaleLowerCase('es'))
    expect(screen.getByText('Todo Dune')).toBeTruthy()
    // Tuya: sin «de @…».
    expect(screen.queryByText(/lists\.sala\.by/)).toBeNull()
  })

  it('el dueño: visibilidad en radios, «Compartir» si es pública, añadir y eliminar', () => {
    renderDetail({ list: list({ isPublic: true }) })
    const grupo = screen.getByRole('radiogroup', { name: 'collection.visibility' })
    expect(within(grupo).getByRole('radio', { name: /collection.public/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'collection.share' })).toHaveAttribute('data-path', '/u/ana/l/l1')
    expect(screen.getByRole('link', { name: 'lists.addItem' })).toHaveAttribute('href', '/discover')
    fireEvent.click(screen.getByRole('button', { name: 'lists.deleteList' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByRole('button', { name: 'lists.deleteList' })).toBeTruthy()
    expect(within(dialogo).getByRole('button', { name: 'common.cancel' })).toBeTruthy()
  })

  it('quien colabora: «de @…», añade y quita, pero sin visibilidad ni eliminar', () => {
    renderDetail({
      list: list({ isCollaborative: true, mediaType: 'movie', template: null }),
      currentUserId: 'u2',
      members: [{ listId: 'l1', userId: 'u2' }],
    })
    expect(screen.getByRole('link', { name: 'lists.sala.by(ana)' })).toHaveAttribute('href', '/u/ana')
    expect(screen.getByRole('link', { name: 'lists.addItem' })).toHaveAttribute('href', '/discover?type=movie')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.deleteList' })).toBeNull()
    expect(screen.getByRole('button', { name: 'lists.removeItemNamed(Dune (2021))' })).toBeTruthy()
  })

  it('sin edición: ni añadir, ni quitar, ni ordenar', () => {
    renderDetail({ currentUserId: 'u2', canEdit: false })
    expect(screen.queryByRole('link', { name: 'lists.addItem' })).toBeNull()
    expect(screen.queryByRole('button', { name: /lists.removeItemNamed/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'lists.reorder' })).toBeNull()
  })

  it('«Títulos» en el `h2` sin el número; los títulos en una lista ordenada con su nota', () => {
    renderDetail()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('lists.itemsTitle')
    expect(document.querySelector('[data-sala-list-count]')!.textContent).toBe('lists.itemCount(2)')
    const lista = screen.getByRole('list', { name: 'lists.itemsTitle' })
    expect(lista.tagName).toBe('OL')
    const titulos = within(lista).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Dune (libro)', 'Dune (2021)'])
    expect(within(lista).getByText('La primera')).toBeTruthy()
    expect(within(lista).getAllByRole('link')[0]).toHaveAttribute('href', '/media/book/1')
  })

  it('ranking: el número a la vista y en el nombre de cada tarjeta', () => {
    renderDetail({ list: list({ template: 'ranking' }) })
    const lista = screen.getByRole('list', { name: 'lists.itemsTitle' })
    expect(within(lista).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '1. Dune (libro)',
      '2. Dune (2021)',
    ])
    // El póster de relleno lleva solo el título de la obra (L4).
    expect(within(lista).getAllByTestId('poster').map((p) => p.textContent)).toEqual(['Dune (libro)', 'Dune (2021)'])
  })

  it('«Quitar» va debajo de la tarjeta (no encima del póster) y dice qué título quita', () => {
    renderDetail()
    const quitar = screen.getByRole('button', { name: 'lists.removeItemNamed(Dune (libro))' })
    expect(quitar.textContent).toContain('lists.sala.removeShort')
    expect(quitar.closest('[data-sala-card]')).toBeNull()
    expect(quitar.closest('[data-sala-list-item="i1"]')).not.toBeNull()
  })

  it('ordenar: la vista de «Sala» con asa, Subir y Bajar, y vuelta a la rejilla con «Listo»', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'lists.reorder' }))
    expect(document.querySelector('[data-sala-reorder]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'lists.moveDown(Dune (libro))' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lists.addNoteNamed(Dune (2021))' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'lists.reorderDone' }))
    expect(document.querySelector('[data-sala-reorder]')).toBeNull()
  })

  it('vacía: estado con «Descubrir» si puede editar', () => {
    renderDetail({ items: [] })
    expect(screen.getByRole('heading', { level: 3, name: 'lists.noItems' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'lists.noItemsDiscover' })).toHaveAttribute('href', '/discover')
  })

  it('quitar: desaparece, «Deshacer» con el foco la devuelve sin llamar al servidor', () => {
    vi.useFakeTimers()
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Dune (libro))' }))
    expect(screen.queryByRole('heading', { level: 3, name: 'Dune (libro)' })).toBeNull()
    expect(document.querySelector('[data-sala-list-count]')!.textContent).toBe('lists.itemCount(1)')
    const deshacer = screen.getByRole('button', { name: 'lists.sala.undo' })
    expect(screen.getByText('lists.sala.removed(Dune (libro))')).toBeTruthy()
    act(() => {
      fireEvent.click(deshacer)
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('heading', { level: 3, name: 'Dune (libro)' })).toBeTruthy()
    expect(removeListItem).not.toHaveBeenCalled()
  })

  it('quitar sin deshacer: al irse el aviso se quita de verdad', async () => {
    vi.useFakeTimers()
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Dune (2021))' }))
    // El foco sale del aviso (si no, el reloj se para).
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    expect(removeListItem).toHaveBeenCalledWith('l1', 'i2')
    expect(screen.queryByRole('heading', { level: 3, name: 'Dune (2021)' })).toBeNull()
  })

  it('al salir de la página con un aviso abierto, lo quitado se quita', () => {
    const { unmount } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'lists.removeItemNamed(Dune (2021))' }))
    unmount()
    expect(removeListItem).toHaveBeenCalledWith('l1', 'i2')
  })
})
