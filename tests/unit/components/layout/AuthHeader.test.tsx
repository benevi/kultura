import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (ns: string) => (key: string, values?: Record<string, unknown>) => {
    if (ns === 'nav' && key === 'notificationsLabel') {
      return values?.count ? `Notificaciones, ${values.count} sin leer` : 'Notificaciones'
    }
    const maps: Record<string, Record<string, string>> = {
      nav: { notifications: 'Notificaciones', home: 'Inicio' },
    }
    return maps[ns]?.[key] ?? key
  }),
}))

const mockPath = vi.hoisted(() => ({ value: '/es/home' as string | null }))
vi.mock('next/headers', () => ({
  headers: () => ({ get: (k: string) => (k === 'x-pathname' ? mockPath.value : null) }),
}))

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
  it('logo apunta a /home y su nombre es el texto visible', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    const logo = screen.getByText('kultura').closest('a')
    expect(logo).toHaveAttribute('href', '/home')
    expect(logo).not.toHaveAttribute('aria-label')
  })

  it('sin notificaciones no muestra badge', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    expect(screen.queryByText(/^\d+$/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  // ACC-10: el contador estaba solo pintado; el lector oía «Notificaciones».
  it('con 3 notificaciones el contador va en el nombre accesible de la campana', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 3 })
    render(el)
    const bell = screen.getByRole('link', { name: 'Notificaciones, 3 sin leer' })
    expect(bell).toHaveAttribute('href', '/notifications')
    expect(screen.getByText('3')).toHaveAttribute('aria-hidden')
  })

  it('con 100 notificaciones muestra "99+"', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 100 })
    render(el)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  // MOV-4: era `w-8 h-8 rounded-md`.
  it('la campana es una caja de 44×44 con radio 16', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    const cls = screen.getByRole('link', { name: 'Notificaciones' }).className
    expect(cls).toContain('w-11')
    expect(cls).toContain('h-11')
    expect(cls).toContain('rounded-2xl')
  })

  it('lleva Social, campana y avatar; el idioma ya no está en la barra', async () => {
    const el = await AuthHeader({ profile: baseProfile, unreadCount: 0 })
    render(el)
    expect(screen.getByTestId('social-menu')).toBeInTheDocument()
    expect(screen.getByTestId('avatar-dropdown')).toHaveAttribute('data-username', 'testuser')
    expect(screen.getByTestId('nav-links')).toHaveAttribute('data-username', 'testuser')
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('en /notifications la campana lleva aria-current="page"', async () => {
    mockPath.value = '/es/notifications'
    render(await AuthHeader({ profile: baseProfile, unreadCount: 0 }))
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toHaveAttribute('aria-current', 'page')
    mockPath.value = '/es/home'
  })

  it('fuera de /notifications (o sin x-pathname) no se marca', async () => {
    mockPath.value = null
    render(await AuthHeader({ profile: baseProfile, unreadCount: 0 }))
    expect(screen.getByRole('link', { name: 'Notificaciones' })).not.toHaveAttribute('aria-current')
    mockPath.value = '/es/home'
  })
})
