import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'es'),
  getTranslations: vi.fn(async () => Object.assign((key: string) => {
    const map: Record<string, string> = {
      footerPrivacy: 'Privacidad',
      footerTerms: 'Términos',
      'attribution.steam': 'Carátulas y descripciones de videojuegos:',
      'attribution.steamTrademark': 'Steam y el logotipo de Steam son marcas de Valve Corporation.',
      'footer.notice': 'Aviso legal',
      'footer.accessibility': 'Accesibilidad',
    }
    return map[key] ?? key
  }, {
    rich: (_key: string, tags: Record<string, (c: string) => React.ReactNode>) => [
      tags.tmdb('TMDB'),
      tags.rawg('RAWG'),
    ],
  })),
}))

import { Footer } from '@/components/layout/Footer'

describe('Footer (D1)', () => {
  it('enlaza a /privacy en el idioma de la página', async () => {
    render(await Footer())
    const link = screen.getByRole('link', { name: 'Privacidad' })
    expect(link).toHaveAttribute('href', '/es/privacy')
  })

  it('enlaza a /terms en el idioma de la página', async () => {
    render(await Footer())
    const link = screen.getByRole('link', { name: 'Términos' })
    expect(link).toHaveAttribute('href', '/es/terms')
  })

  it('enlaza también al aviso legal y a la declaración de accesibilidad (F-19)', async () => {
    render(await Footer())
    expect(screen.getByRole('link', { name: 'Aviso legal' })).toHaveAttribute('href', '/es/legal')
    expect(screen.getByRole('link', { name: 'Accesibilidad' })).toHaveAttribute('href', '/es/accessibility')
    expect(screen.getAllByRole('link').slice(0, 4).map((a) => a.getAttribute('href'))).toEqual([
      '/es/privacy',
      '/es/terms',
      '/es/legal',
      '/es/accessibility',
    ])
  })

  it('con las claves de F-19 en legal.nav usa esos rótulos', async () => {
    const { getTranslations } = await import('next-intl/server')
    vi.mocked(getTranslations).mockImplementationOnce((async () =>
      Object.assign((key: string) => ({ 'nav.notice': 'Aviso legal (F-19)', 'nav.accessibility': 'Accesibilidad (F-19)' })[key] ?? key, {
        has: (key: string) => key.startsWith('nav.'),
        rich: (_k: string, tags: Record<string, (c: string) => React.ReactNode>) => [tags.tmdb('TMDB'), tags.rawg('RAWG')],
      })) as never)
    render(await Footer())
    expect(screen.getByRole('link', { name: 'Aviso legal (F-19)' })).toHaveAttribute('href', '/es/legal')
    expect(screen.getByRole('link', { name: 'Accesibilidad (F-19)' })).toHaveAttribute('href', '/es/accessibility')
  })

  it('muestra el copyright', async () => {
    render(await Footer())
    expect(screen.getByText(new RegExp(`${new Date().getFullYear()} KULTURA`))).toBeInTheDocument()
  })

  it('atribuye los datos a TMDB y RAWG con enlace, como exigen', async () => {
    render(await Footer())
    expect(screen.getByRole('link', { name: 'TMDB' })).toHaveAttribute('href', 'https://www.themoviedb.org')
    expect(screen.getByRole('link', { name: 'RAWG' })).toHaveAttribute('href', 'https://rawg.io')
  })

  it('atribuye a Steam las carátulas de juegos, con enlace sin nofollow y aviso de marca', async () => {
    render(await Footer())
    const steam = screen.getByRole('link', { name: 'Steam' })
    expect(steam).toHaveAttribute('href', 'https://store.steampowered.com')
    expect(steam.getAttribute('rel')).not.toContain('nofollow')
    expect(screen.getByText(/Carátulas y descripciones de videojuegos/)).toBeInTheDocument()
    expect(screen.getByText(/marcas de Valve Corporation/)).toBeInTheDocument()
  })

  it('pinta enlaces normales: no carga el Link de next-intl (REN-9)', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/components/layout/Footer.tsx', 'utf8')
    expect(source).not.toMatch(/@\/i18n\/navigation/)
  })
})
