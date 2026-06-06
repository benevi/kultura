import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      home: 'Inicio',
      discover: 'Descubrir',
      chat: 'Mensajes',
      library: 'Mi biblioteca',
      groups: 'Grupos',
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

vi.mock('lucide-react', () => ({
  Home: () => <svg data-testid="icon-home" />,
  Compass: () => <svg data-testid="icon-compass" />,
  MessageCircle: () => <svg data-testid="icon-messagecircle" />,
  BookOpen: () => <svg data-testid="icon-bookopen" />,
  Users: () => <svg data-testid="icon-users" />,
}))

import { BottomNav } from '@/components/layout/BottomNav'

describe('BottomNav', () => {
  it('renderiza los 5 items', () => {
    render(<BottomNav />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Descubrir')).toBeInTheDocument()
    expect(screen.getByText('Mensajes')).toBeInTheDocument()
    expect(screen.getByText('Mi biblioteca')).toBeInTheDocument()
    expect(screen.getByText('Grupos')).toBeInTheDocument()
  })

  it('item activo tiene clase text-accent-positive', () => {
    render(<BottomNav />)
    const homeLink = screen.getByText('Inicio').closest('a')
    expect(homeLink?.className).toContain('text-accent-positive')
  })

  it('item inactivo tiene clase text-text-secondary', () => {
    render(<BottomNav />)
    const discoverLink = screen.getByText('Descubrir').closest('a')
    expect(discoverLink?.className).toContain('text-text-secondary')
  })

  it('link de grupos apunta a /groups', () => {
    render(<BottomNav />)
    const groupsLink = screen.getByText('Grupos').closest('a')
    expect(groupsLink).toHaveAttribute('href', '/groups')
  })
})
