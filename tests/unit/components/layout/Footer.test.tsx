import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const map: Record<string, string> = {
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

import { Footer } from '@/components/layout/Footer'

describe('Footer (D1)', () => {
  it('enlaza a /privacy', async () => {
    render(await Footer())
    const link = screen.getByRole('link', { name: 'Privacidad' })
    expect(link).toHaveAttribute('href', '/privacy')
  })

  it('enlaza a /terms', async () => {
    render(await Footer())
    const link = screen.getByRole('link', { name: 'Términos' })
    expect(link).toHaveAttribute('href', '/terms')
  })

  it('muestra el copyright', async () => {
    render(await Footer())
    expect(screen.getByText(new RegExp(`${new Date().getFullYear()} KULTURA`))).toBeInTheDocument()
  })
})
