// ============================================================
// KULTURA — Índice de listas en «Sala» (fase 8.5 L1): `h1` y «Nueva lista»,
// una tarjeta por lista con su mosaico de cuatro casillas (las portadas en su
// orden y el panel en las que faltan), el nombre como único enlace en un
// `h2`, los datos con palabras (formato, títulos, pública o privada,
// colaborativa, plantilla y dueño si no es quien mira) y el vacío.
// ============================================================

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { List } from '@/types/list'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, v?: Record<string, unknown>) =>
    `${ns}.${key}${v ? `(${Object.values(v).join('|')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/components/sala/SalaPoster', () => ({
  SalaPoster: ({ title, src }: { title: string; src?: string | null }) => <div data-testid="poster" data-src={src ?? ''}>{title}</div>,
}))
vi.mock('next/dynamic', () => ({
  default: () =>
    function CreateListModal({ onClose }: { onClose: () => void }) {
      return <button data-testid="create-modal" onClick={onClose}>cerrar</button>
    },
}))

import { SalaListsIndex } from '@/components/lists/sala/SalaListsIndex'

const OWNER = { id: 'u1', username: 'benevi', avatarColor: 'blue', avatarInitials: 'BE', createdAt: '' }

function list(id: string, extra: Partial<List> = {}): List {
  return {
    id,
    ownerId: 'u1',
    name: `Lista ${id}`,
    mediaType: 'movie',
    isCollaborative: false,
    isPublic: false,
    createdAt: '2026-01-01',
    owner: OWNER,
    itemCount: 0,
    covers: [],
    ...extra,
  }
}

describe('SalaListsIndex', () => {
  it('cabecera con `h1` y una tarjeta por lista con `h2` y un solo enlace', () => {
    render(
      <SalaListsIndex
        viewerId="u1"
        lists={[
          list('a', {
            itemCount: 6,
            covers: [
              { title: 'Dune', poster: 'https://x/d.jpg', type: 'movie' },
              { title: 'Arrival', poster: null, type: 'movie' },
            ],
          }),
          list('b', {
            mediaType: 'mixed',
            template: 'ranking',
            isPublic: true,
            isCollaborative: true,
            ownerId: 'u2',
            owner: { ...OWNER, id: 'u2', username: 'lucia' },
            itemCount: 1,
          }),
        ]}
      />
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('lists.title')
    expect(screen.getByRole('button', { name: 'lists.newList' })).toBeTruthy()

    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(2)

    const a = within(cards[0])
    expect(a.getByRole('heading', { level: 2 }).textContent).toBe('Lista a')
    expect(a.getAllByRole('link')).toHaveLength(1)
    expect(a.getByRole('link').getAttribute('href')).toBe('/lists/a')
    // Mosaico: dos portadas en su orden y dos casillas vacías; todo adorno.
    expect(a.getAllByTestId('poster').map((p) => p.textContent)).toEqual(['Dune', 'Arrival'])
    const mosaic = cards[0].querySelector('[data-sala-list-mosaic]')!
    expect(mosaic.getAttribute('aria-hidden')).toBe('true')
    expect(mosaic.children).toHaveLength(4)
    // Datos con palabras y en minúscula (el doble de `t` devuelve la clave); sin «de @…» en las propias.
    expect(cards[0].textContent).toContain('discoverfilters.typebadge.movie')
    expect(cards[0].textContent).toContain('lists.itemCount(6)')
    expect(cards[0].textContent).toContain('lists.visibilityprivate')
    expect(cards[0].textContent).not.toContain('lists.sala.by')
    expect(cards[0].textContent).not.toContain('lists.sala.collaborative')

    const b = cards[1].textContent
    expect(b).toContain('lists.mediatypemixed')
    expect(b).toContain('lists.visibilitypublic')
    expect(b).toContain('lists.sala.collaborative')
    expect(b).toContain('lists.template.ranking')
    expect(b).toContain('lists.sala.by(lucia)')
    expect(cards[1].querySelector('[data-sala-list-mosaic]')!.children).toHaveLength(4)
  })

  it('los separadores son un punto a la vista y una coma para el lector', () => {
    render(<SalaListsIndex viewerId="u1" lists={[list('a', { itemCount: 2 })]} />)
    const card = screen.getByRole('listitem')
    expect(Array.from(card.querySelectorAll('[aria-hidden="true"]')).some((n) => n.textContent === ' · ')).toBe(true)
    expect(card.querySelector('.sr-only')?.textContent).toBe(', ')
  })

  it('sin listas: el vacío con «Nueva lista», sin rejilla', () => {
    render(<SalaListsIndex viewerId="u1" lists={[]} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('lists.noLists')
    expect(screen.getByText('lists.noListsHint')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'lists.newList' })).toHaveLength(1)
  })

  it('«Nueva lista» abre el diálogo y al cerrarlo desaparece', () => {
    render(<SalaListsIndex viewerId="u1" lists={[list('a')]} />)
    expect(screen.queryByTestId('create-modal')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'lists.newList' }))
    fireEvent.click(screen.getByTestId('create-modal'))
    expect(screen.queryByTestId('create-modal')).toBeNull()
  })
})
