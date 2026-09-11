import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const map: Record<string, string> = {
      suggestions: 'Sugerencias',
      footerPrivacy: 'Privacidad',
      footerTerms: 'Términos',
    }
    return map[key] ?? key
  }),
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
})
