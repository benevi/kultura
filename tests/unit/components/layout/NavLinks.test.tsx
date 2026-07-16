// ============================================================
// KULTURA — NavLinks unit tests (E96)
// Badge de mensajes no leídos en el link de chat (nav desktop).
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

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  usePathname: vi.fn(() => '/home'),
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
  })

  it('renderiza los 8 links de navegación', () => {
    render(<NavLinks />)
    for (const label of ['Inicio', 'Descubrir', 'Mi biblioteca', 'Listas', 'Mensajes', 'Amigos', 'Grupos', 'Sugerencias']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
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
