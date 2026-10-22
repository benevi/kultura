import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => Object.assign((key: string) => {
    const map: Record<string, string> = {
      suggestions: 'Sugerencias',
      footerPrivacy: 'Privacidad',
      footerTerms: 'Términos',
    }
    return map[key] ?? key
  }, {
    rich: (_key: string, tags: Record<string, (c: string) => React.ReactNode>) => [
      tags.tmdb('TMDB'),
      tags.rawg('RAWG'),
    ],
  })),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { AppFooter } from '@/components/layout/AppFooter'

describe('AppFooter (D1)', () => {
  it('enlaza a /privacy', async () => {
    render(await AppFooter())
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute('href', '/privacy')
  })

  it('enlaza a /terms', async () => {
    render(await AppFooter())
    expect(screen.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', '/terms')
  })

  it('conserva el enlace a /suggestions (comportamiento previo)', async () => {
    render(await AppFooter())
    expect(screen.getByRole('link', { name: 'Sugerencias' })).toHaveAttribute('href', '/suggestions')
  })

  it('los enlaces van en una nav con nombre y miden 44 px de alto (MOV-4, ACC-12)', async () => {
    render(await AppFooter())
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label')
    for (const a of Array.from(nav.querySelectorAll('a'))) expect(a.className).toContain('min-h-11')
  })

  // Regresión (V8/D1): `border-border/40` no generaba regla y el borde salía gris.
  it('usa un borde que existe (border-surface-border)', async () => {
    const { container } = render(await AppFooter())
    const footer = container.querySelector('footer')!
    expect(footer.className).toContain('border-surface-border')
    expect(footer.className).not.toContain('border-border/40')
  })

  it('atribuye los datos a TMDB y RAWG con enlace, como exigen', async () => {
    render(await AppFooter())
    expect(screen.getByRole('link', { name: 'TMDB' })).toHaveAttribute('href', 'https://www.themoviedb.org')
    expect(screen.getByRole('link', { name: 'RAWG' })).toHaveAttribute('href', 'https://rawg.io')
  })
})
