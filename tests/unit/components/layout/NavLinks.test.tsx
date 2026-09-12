// ============================================================
// KULTURA — NavLinks unit tests (E96, actualizado en G2)
// Badge de mensajes no leídos en el link de chat (nav desktop) +
// icono/pill de estado activo introducidos en G2.
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      home: 'Inicio',
      discover: 'Descubrir',
      library: 'Mi biblioteca',
      lists: 'Listas',
      chat: 'Mensajes',
      friends: 'Amigos',
      groups: 'Grupos',
      suggestions: 'Sugerencias',
    }
    return map[key] ?? key
  }),
}))

const mockPathname = vi.hoisted(() => ({ value: '/home' }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  usePathname: vi.fn(() => mockPathname.value),
}))

const unreadState = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  useUnreadChat: () => ({
    unreadCount: unreadState.count,
    refreshUnread: vi.fn(),
    markConversationRead: vi.fn(),
  }),
}))

import { NavLinks } from '@/components/layout/NavLinks'

describe('NavLinks', () => {
  beforeEach(() => {
    unreadState.count = 0
    mockPathname.value = '/home'
  })

  it('renderiza los 8 links de navegación', () => {
    render(<NavLinks />)
    for (const label of ['Inicio', 'Descubrir', 'Mi biblioteca', 'Listas', 'Mensajes', 'Amigos', 'Grupos', 'Sugerencias']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('cada link tiene un icono (svg) junto a la etiqueta', () => {
    render(<NavLinks />)
    const link = screen.getByText('Inicio').closest('a')
    expect(link?.querySelector('svg')).toBeInTheDocument()
  })

  it('la ruta activa recibe el tratamiento de pill (fondo accent-positive)', () => {
    mockPathname.value = '/discover'
    render(<NavLinks />)
    const activeLink = screen.getByText('Descubrir').closest('a')
    const inactiveLink = screen.getByText('Inicio').closest('a')
    expect(activeLink?.className).toContain('bg-accent-positive')
    expect(activeLink?.className).toContain('text-on-accent-positive')
    expect(inactiveLink?.className).not.toContain('bg-accent-positive')
    expect(inactiveLink?.className).toContain('text-text-secondary')
  })

  it('sin no-leídos no muestra badge', () => {
    render(<NavLinks />)
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('con 5 no-leídos muestra badge "5" en el link de chat', () => {
    unreadState.count = 5
    render(<NavLinks />)
    const badge = screen.getByText('5')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('a')).toHaveAttribute('href', '/chat')
  })

  it('con más de 99 muestra "99+"', () => {
    unreadState.count = 150
    render(<NavLinks />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })
})
