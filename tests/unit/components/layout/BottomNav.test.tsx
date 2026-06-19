import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      home: 'Inicio',
      discover: 'Descubrir',
      chat: 'Mensajes',
      library: 'Mi biblioteca',
      friends: 'Amigos',
      groups: 'Grupos',
      lists: 'Listas',
      suggestions: 'Sugerencias',
      search: 'Buscar',
      more: 'Más',
    }
    return map[key] ?? key
  }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, onClick }: { href: string; children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <a href={href} className={className} onClick={onClick}>{children}</a>
  ),
  usePathname: vi.fn(() => '/home'),
}))

vi.mock('lucide-react', () => ({
  Home: () => <svg data-testid="icon-home" />,
  Compass: () => <svg data-testid="icon-compass" />,
  MessageCircle: () => <svg data-testid="icon-messagecircle" />,
  BookOpen: () => <svg data-testid="icon-bookopen" />,
  MoreHorizontal: () => <svg data-testid="icon-more" />,
  Users: () => <svg data-testid="icon-users" />,
  Users2: () => <svg data-testid="icon-users2" />,
  ListChecks: () => <svg data-testid="icon-lists" />,
  Lightbulb: () => <svg data-testid="icon-suggestions" />,
  Search: () => <svg data-testid="icon-search" />,
}))

import { BottomNav } from '@/components/layout/BottomNav'

describe('BottomNav', () => {
  it('renderiza 5 items: home·discover·chat·library·Más', () => {
    render(<BottomNav />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Descubrir')).toBeInTheDocument()
    expect(screen.getByText('Mensajes')).toBeInTheDocument()
    expect(screen.getByText('Mi biblioteca')).toBeInTheDocument()
    expect(screen.getByText('Más')).toBeInTheDocument()
  })

  it('no incluye friends ni groups directamente en la barra', () => {
    render(<BottomNav />)
    // Solo aparecen tras abrir el sheet, no en la barra inicial
    expect(screen.queryByText('Amigos')).not.toBeInTheDocument()
    expect(screen.queryByText('Grupos')).not.toBeInTheDocument()
  })

  it('"Más" es un button, no un link', () => {
    render(<BottomNav />)
    const more = screen.getByText('Más').closest('button')
    expect(more).toBeInTheDocument()
    expect(more).toHaveAttribute('aria-haspopup', 'dialog')
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

  it('click en "Más" abre el sheet (muestra friends, groups, lists, suggestions, search)', () => {
    render(<BottomNav />)
    expect(screen.queryByTestId('more-sheet-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Más'))
    expect(screen.getByTestId('more-sheet-panel')).toBeInTheDocument()
    expect(screen.getByText('Amigos')).toBeInTheDocument()
    expect(screen.getByText('Grupos')).toBeInTheDocument()
    expect(screen.getByText('Listas')).toBeInTheDocument()
    expect(screen.getByText('Sugerencias')).toBeInTheDocument()
    expect(screen.getByText('Buscar')).toBeInTheDocument()
  })

  it('"Más" se marca activo (accent) mientras el sheet está abierto', () => {
    render(<BottomNav />)
    const more = screen.getByText('Más').closest('button')
    expect(more?.className).toContain('text-text-secondary')
    fireEvent.click(screen.getByText('Más'))
    expect(more?.className).toContain('text-accent-positive')
  })

  it('click en overlay cierra el sheet', () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByText('Más'))
    fireEvent.click(screen.getByTestId('more-sheet-overlay'))
    expect(screen.queryByTestId('more-sheet-panel')).not.toBeInTheDocument()
  })
})
