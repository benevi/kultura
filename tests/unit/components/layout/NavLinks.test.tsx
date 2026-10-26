// ============================================================
// KULTURA — NavLinks (navegación de escritorio, DIS-9)
// Los 5 destinos comunes, activo por prefijo y marcado accesible.
// ============================================================

import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      home: 'Inicio',
      discover: 'Descubrir',
      libraryTab: 'Biblioteca',
      lists: 'Listas',
      profileTab: 'Perfil',
      primaryNav: 'Navegación principal',
      label: 'Calendario',
    }
    return map[key] ?? key
  }),
}))

const mockPathname = vi.hoisted(() => ({ value: '/home' }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...rest}>{children}</a>
  ),
  usePathname: vi.fn(() => mockPathname.value),
}))

import { NavLinks } from '@/components/layout/NavLinks'
import { isNavActive, primaryNavItems } from '@/components/layout/nav-shared'

describe('NavLinks', () => {
  beforeEach(() => {
    mockPathname.value = '/home'
  })

  it('pinta los 5 destinos en orden: Inicio, Descubrir, Biblioteca, Listas, Perfil (y el Calendario desde xl)', () => {
    render(<NavLinks username="ana" />)
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Inicio', 'Descubrir', 'Biblioteca', 'Listas', 'Perfil', 'Calendario'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/home', '/discover', '/library', '/lists', '/profile/ana', '/calendar'])
  })

  // F-28: a 768-1279 px no cabe un sexto destino; ahí y en móvil está en el menú del avatar.
  it('el Calendario solo se ve desde xl y se marca activo en /calendar', () => {
    mockPathname.value = '/calendar'
    render(<NavLinks username="ana" />)
    const calendar = screen.getByRole('link', { name: 'Calendario' })
    expect(calendar.closest('li')?.className).toContain('hidden xl:block')
    expect(calendar).toHaveAttribute('aria-current', 'page')
    expect(calendar.className).toContain('min-h-11')
  })

  it('ya no mete chat, amigos, grupos ni sugerencias en la barra (van en Social y en el avatar)', () => {
    render(<NavLinks username="ana" />)
    for (const href of ['/chat', '/friends', '/groups', '/suggestions']) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull()
    }
  })

  it('el activo lleva aria-current="page" y pastilla neutra (no el acento)', () => {
    mockPathname.value = '/discover'
    render(<NavLinks username="ana" />)
    const active = screen.getByRole('link', { name: 'Descubrir' })
    const inactive = screen.getByRole('link', { name: 'Inicio' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(inactive).not.toHaveAttribute('aria-current')
    expect(active.className).toContain('bg-surface-elevated')
    expect(active.className).not.toContain('bg-accent')
  })

  // Regresión (V10/MOV-7): el activo era `pathname === href`, así que en una
  // subpágina no se marcaba ninguna pestaña.
  it('se marca por prefijo: /lists/abc → Listas, /profile/ana/x → Perfil', () => {
    mockPathname.value = '/lists/abc'
    const { unmount } = render(<NavLinks username="ana" />)
    expect(screen.getByRole('link', { name: 'Listas' })).toHaveAttribute('aria-current', 'page')
    unmount()
    mockPathname.value = '/profile/ana'
    render(<NavLinks username="ana" />)
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
  })

  it('el perfil de OTRA persona no marca «Perfil»', () => {
    mockPathname.value = '/profile/benevi'
    render(<NavLinks username="ana" />)
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current')
  })

  it('cada enlace mide al menos 44 px de alto', () => {
    render(<NavLinks username="ana" />)
    for (const a of screen.getAllByRole('link')) expect(a.className).toContain('min-h-11')
  })
})

describe('isNavActive', () => {
  it('compara por segmentos, no por texto', () => {
    expect(isNavActive('/chat/123', '/chat')).toBe(true)
    expect(isNavActive('/chat', '/chat')).toBe(true)
    expect(isNavActive('/chat/', '/chat')).toBe(true)
    expect(isNavActive('/chatroom', '/chat')).toBe(false)
    expect(isNavActive('/home', '/chat')).toBe(false)
  })
})

describe('primaryNavItems', () => {
  it('codifica el nombre de usuario en la URL del perfil', () => {
    expect(primaryNavItems('a b').at(-1)?.href).toBe('/profile/a%20b')
  })
})
