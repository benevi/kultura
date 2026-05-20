import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: ({ src, alt, fill, className, priority }: { src: string; alt: string; fill?: boolean; className?: string; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} data-priority={priority} />
  ),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}))

import { HeroSection } from '@/components/home/HeroSection'
import type { HeroItem } from '@/components/home/HeroSection'

const baseMedia = {
  id: 'movie_550',
  title: 'Fight Club',
  poster: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  year: 1999,
  type: 'movie',
  synopsis: 'An insomniac office worker forms an underground fight club.',
}

const baseItem: HeroItem = {
  media_id: 'movie_550',
  episode_progress: null,
  media: baseMedia,
}

describe('HeroSection', () => {
  it('con item in_progress muestra el título y botón Continuar con href correcto', () => {
    render(<HeroSection item={baseItem} />)
    expect(screen.getByText('Fight Club')).toBeInTheDocument()
    expect(screen.getByText('continuing')).toBeInTheDocument()
    const link = screen.getByText('continue').closest('a')
    expect(link).toHaveAttribute('href', '/media/movie/550')
  })

  it('con episode_progress con current y total muestra la barra de progreso', () => {
    const itemWithProgress: HeroItem = {
      ...baseItem,
      episode_progress: { episode: 5, current: 5, total: 10 },
    }
    render(<HeroSection item={itemWithProgress} />)
    expect(screen.getByTestId('progress-fill')).toBeInTheDocument()
  })

  it('sin item muestra texto bienvenida y botón Explorar contenido', () => {
    render(<HeroSection item={null} />)
    expect(screen.getByText('welcomeTitle')).toBeInTheDocument()
    expect(screen.getByText('welcomeSubtitle')).toBeInTheDocument()
    const link = screen.getByText('goDiscover').closest('a')
    expect(link).toHaveAttribute('href', '/discover')
  })

  it('con item sin synopsis no crashea', () => {
    const itemNoSynopsis: HeroItem = {
      ...baseItem,
      media: { ...baseMedia, synopsis: null },
    }
    render(<HeroSection item={itemNoSynopsis} />)
    expect(screen.getByText('Fight Club')).toBeInTheDocument()
    expect(screen.queryByText('An insomniac')).not.toBeInTheDocument()
  })
})
