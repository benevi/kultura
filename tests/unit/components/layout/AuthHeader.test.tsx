import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children?: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...rest}>{children}</a>
  ),
}))

vi.mock('@/components/layout/NavLinks', () => ({
  NavLinks: ({ username }: { username: string }) => <nav data-testid="nav-links" data-username={username} />,
}))

vi.mock('@/components/layout/SocialMenu', () => ({
  SocialMenu: () => <div data-testid="social-menu" />,
}))

vi.mock('@/components/layout/NotificationsBell', () => ({
  NotificationsBell: ({ unreadCount }: { unreadCount: number }) => <div data-testid="bell" data-count={unreadCount} />,
}))

vi.mock('@/components/layout/AvatarDropdown', () => ({
  AvatarDropdown: ({ username, avatarInitials }: { username: string; avatarColor: string; avatarInitials: string }) => (
    <div data-testid="avatar-dropdown" data-username={username}>{avatarInitials}</div>
  ),
}))

import { AuthHeader } from '@/components/layout/AuthHeader'

const baseProfile = {
  username: 'testuser',
  avatar_color: '#E82020',
  avatar_initials: 'TU',
}

describe('AuthHeader', () => {
  it('logo apunta a /home y su nombre es el texto visible', () => {
    render(<AuthHeader profile={baseProfile} unreadCount={0} />)
    const logo = screen.getByText('kultura').closest('a')
    expect(logo).toHaveAttribute('href', '/home')
    expect(logo).not.toHaveAttribute('aria-label')
  })

  it('pasa el contador de notificaciones a la campana', () => {
    render(<AuthHeader profile={baseProfile} unreadCount={7} />)
    expect(screen.getByTestId('bell')).toHaveAttribute('data-count', '7')
  })

  it('lleva Social, campana y avatar; el idioma ya no está en la barra', () => {
    render(<AuthHeader profile={baseProfile} unreadCount={0} />)
    expect(screen.getByTestId('social-menu')).toBeInTheDocument()
    expect(screen.getByTestId('avatar-dropdown')).toHaveAttribute('data-username', 'testuser')
    expect(screen.getByTestId('nav-links')).toHaveAttribute('data-username', 'testuser')
    expect(screen.queryByRole('group')).toBeNull()
  })
})
