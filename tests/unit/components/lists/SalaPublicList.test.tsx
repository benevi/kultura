// ============================================================
// KULTURA — Lista pública en «Sala» (fase 8.5 L5): cabecera en lectura (`h1`,
// datos con palabras en minúscula, el dueño con su propio enlace, sin el
// enlace compuesto de hoy), la denuncia en la cabecera, la rejilla ordenada
// con el puesto en un ranking y la nota del dueño, una sola llamada a
// registrarse y la lista vacía.
// ============================================================

import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'es',
}))
vi.mock('@/components/sala/SalaPoster', () => ({
  SalaPoster: ({ title }: { title: string }) => <div data-testid="poster">{title}</div>,
}))

import { SalaPublicList, type SalaPublicListProps } from '@/components/lists/sala/SalaPublicList'

function props(extra: Partial<SalaPublicListProps> = {}): SalaPublicListProps {
  return {
    name: 'Top',
    facts: ['películas', 'ranking personal', '2 títulos'],
    owner: { username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', avatarIcon: null, label: 'de @ana', href: '/u/ana' },
    description: 'Mis favoritas',
    ranked: true,
    entries: [
      { mediaId: 'movie_2', href: '/media/movie/2', title: 'Arrival', format: 'movie', formatLabel: 'Película', year: 2016, poster: null, note: 'La mejor' },
      { mediaId: 'movie_1', href: '/media/movie/1', title: 'Dune', format: 'movie', formatLabel: 'Película', year: 2021, poster: '/p1.jpg', note: null },
    ],
    labels: { items: 'Títulos', empty: 'Esta lista está vacía', loading: 'Cargando…' },
    report: <a href="/report?target=list&id=l1">Denunciar esta lista</a>,
    cta: { title: '¿Y la tuya?', text: 'Guarda todo', button: 'Crea tu colección', href: '/login?mode=register&ref=ana' },
    ...extra,
  }
}

describe('SalaPublicList', () => {
  it('cabecera en lectura: h1, datos en minúscula y el dueño con su propio enlace', () => {
    const { container } = render(<SalaPublicList {...props()} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Top')
    const facts = container.querySelector('[data-sala-public-list-facts]')!
    expect(facts.textContent).toBe('películas · , ranking personal · , 2 títulos')
    const owner = screen.getByRole('link', { name: 'de @ana' })
    expect(owner.getAttribute('href')).toBe('/u/ana')
    // Ya no hay un enlace que lo junte todo (nombre, títulos, «Ver toda la colección»).
    expect(owner.textContent).toBe('de @ana')
    expect(screen.getByText('Mis favoritas')).toBeTruthy()
    // Sin miembros ni controles de edición: es una página de lectura.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('la denuncia va en la cabecera', () => {
    render(<SalaPublicList {...props()} />)
    const header = document.querySelector('header')!
    expect(within(header).getByRole('link', { name: 'Denunciar esta lista' })).toBeTruthy()
  })

  it('rejilla ordenada: en un ranking el puesto en el nombre y la nota del dueño', () => {
    render(<SalaPublicList {...props()} />)
    const list = screen.getByRole('list', { name: 'Títulos' })
    expect(list.tagName).toBe('OL')
    const links = within(list).getAllByRole('link')
    expect(links[0].getAttribute('href')).toBe('/media/movie/2')
    expect(links[0].textContent).toContain('1. ')
    expect(links[1].textContent).toContain('2. ')
    expect(within(list).getByText('La mejor')).toBeTruthy()
  })

  it('sin ranking, sin número', () => {
    render(<SalaPublicList {...props({ ranked: false })} />)
    const links = within(screen.getByRole('list', { name: 'Títulos' })).getAllByRole('link')
    expect(links[0].textContent).not.toContain('1. ')
  })

  it('una sola llamada a registrarse, y ninguna con sesión', () => {
    const { rerender } = render(<SalaPublicList {...props()} />)
    expect(screen.getAllByRole('link', { name: 'Crea tu colección' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Crea tu colección' }).getAttribute('href')).toBe('/login?mode=register&ref=ana')
    rerender(<SalaPublicList {...props({ cta: null })} />)
    expect(screen.queryByRole('link', { name: 'Crea tu colección' })).toBeNull()
  })

  it('lista vacía', () => {
    render(<SalaPublicList {...props({ entries: [] })} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Esta lista está vacía' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Títulos' })).toBeNull()
  })
})
