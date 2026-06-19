import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
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
}))

vi.mock('lucide-react', () => ({
  Users2: () => <svg data-testid="icon-users2" />,
  Users: () => <svg data-testid="icon-users" />,
  ListChecks: () => <svg data-testid="icon-lists" />,
  Lightbulb: () => <svg data-testid="icon-suggestions" />,
  Search: () => <svg data-testid="icon-search" />,
}))

import { MoreSheet } from '@/components/ui/MoreSheet'

describe('MoreSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no renderiza nada cuando isOpen=false', () => {
    const { container } = render(<MoreSheet isOpen={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza los 5 items cuando isOpen=true', () => {
    render(<MoreSheet isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Amigos')).toBeInTheDocument()
    expect(screen.getByText('Grupos')).toBeInTheDocument()
    expect(screen.getByText('Listas')).toBeInTheDocument()
    expect(screen.getByText('Sugerencias')).toBeInTheDocument()
    expect(screen.getByText('Buscar')).toBeInTheDocument()
  })

  it('los items apuntan a sus rutas i18n-aware', () => {
    render(<MoreSheet isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Amigos').closest('a')).toHaveAttribute('href', '/friends')
    expect(screen.getByText('Grupos').closest('a')).toHaveAttribute('href', '/groups')
    expect(screen.getByText('Listas').closest('a')).toHaveAttribute('href', '/lists')
    expect(screen.getByText('Sugerencias').closest('a')).toHaveAttribute('href', '/suggestions')
    expect(screen.getByText('Buscar').closest('a')).toHaveAttribute('href', '/search')
  })

  it('panel tiene role=dialog y aria-modal', () => {
    render(<MoreSheet isOpen onClose={vi.fn()} />)
    const panel = screen.getByTestId('more-sheet-panel')
    expect(panel).toHaveAttribute('role', 'dialog')
    expect(panel).toHaveAttribute('aria-modal', 'true')
  })

  it('click en overlay llama onClose', () => {
    const onClose = vi.fn()
    render(<MoreSheet isOpen onClose={onClose} />)
    fireEvent.click(screen.getByTestId('more-sheet-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en panel NO cierra (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<MoreSheet isOpen onClose={onClose} />)
    fireEvent.click(screen.getByTestId('more-sheet-panel'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('click en un item llama onClose (navega y cierra)', () => {
    const onClose = vi.fn()
    render(<MoreSheet isOpen onClose={onClose} />)
    fireEvent.click(screen.getByText('Amigos'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc cierra el sheet', () => {
    const onClose = vi.fn()
    render(<MoreSheet isOpen onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
