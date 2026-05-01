import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { MediaRow } from '@/components/home/MediaRow'

const sampleItems = [
  { mediaId: 'movie_550', title: 'Fight Club', poster: null, type: 'movie' },
  { mediaId: 'tv_1396', title: 'Breaking Bad', poster: null, type: 'tv' },
  { mediaId: 'anime_1', title: 'Naruto', poster: null, type: 'anime' },
]

describe('MediaRow', () => {
  it('con 3 items renderiza 3 links con href correctos', () => {
    render(<MediaRow title="Recientes" items={sampleItems} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '/media/movie/550')
    expect(links[1]).toHaveAttribute('href', '/media/tv/1396')
    expect(links[2]).toHaveAttribute('href', '/media/anime/1')
  })

  it('con items vacíos y emptyMessage muestra el mensaje', () => {
    render(<MediaRow title="Recientes" items={[]} emptyMessage="No hay nada aquí" />)
    expect(screen.getByText('No hay nada aquí')).toBeInTheDocument()
  })

  it('con items vacíos y emptyAction muestra el link de acción', () => {
    render(
      <MediaRow
        title="Recientes"
        items={[]}
        emptyMessage="Sin amigos"
        emptyAction={{ label: 'Añadir amigos', href: '/friends' }}
      />
    )
    const actionLink = screen.getByText('Añadir amigos').closest('a')
    expect(actionLink).toHaveAttribute('href', '/friends')
  })

  it('con items vacíos sin emptyMessage retorna null', () => {
    const { container } = render(<MediaRow title="Recientes" items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('con isLoading=true muestra skeletons y no items reales', () => {
    const { container } = render(<MediaRow title="Recientes" items={sampleItems} isLoading />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByText('Fight Club')).not.toBeInTheDocument()
  })
})
