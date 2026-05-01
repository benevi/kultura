import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (ns: string) => (key: string) => {
    const maps: Record<string, Record<string, string>> = {
      nav: {
        search: 'Buscar',
        notifications: 'Notificaciones',
        profile: 'Mi perfil',
        settings: 'Ajustes',
      },
      auth: { signOut: 'Cerrar sesión' },
    }
    return maps[ns]?.[key] ?? key
  }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, 'aria-label': ariaLabel }: { href: string; children?: React.ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={ariaLabel}>{children}</a>
  ),
}))

vi.mock('@/components/layout/NavLinks', () => ({
  NavLinks: () => <nav data-testid="nav-links" />,
}))

vi.mock('@/components/layout/AvatarDropdown', () => ({
  AvatarDropdown: ({ username, avatarInitials }: { username: string; avatarColor: string; avatarInitials: string }) => (
    <div data-testid="avatar-dropdown" data-username={username}>{avatarInitials}</div>
  ),
}))

vi.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />,
}))

import { AuthHeader } from '@/components/layout/AuthHeader'

const baseProfile = {
  username: 'testuser',
  avatar_color: '#E82020',
  avatar_initials: 'TU',
}

describe('AuthHeader', () => {
  it('logo apunta a /home', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    const logo = screen.getByText('KULTURA').closest('a')
    expect(logo).toHaveAttribute('href', '/home')
  })

  it('sin notificaciones no muestra badge', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('con 3 notificaciones muestra badge "3"', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 3 })
    render(el)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('con 100 notificaciones muestra "99+"', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 100 })
    render(el)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('avatar dropdown recibe el username', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    expect(screen.getByTestId('avatar-dropdown')).toHaveAttribute('data-username', 'testuser')
  })
})
