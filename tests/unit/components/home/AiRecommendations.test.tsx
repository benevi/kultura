import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}))

vi.mock('@/components/media/MediaCard', () => ({
  MediaCard: ({ item }: { item: { title: string } }) => <div data-testid="card">{item.title}</div>,
}))

import { AiRecommendations } from '@/components/home/AiRecommendations'

function mockFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }))
}

afterEach(() => vi.unstubAllGlobals())

describe('AiRecommendations — cuenta nueva', () => {
  it('sin recomendaciones enseña lo popular con su propio cartel, no el de la IA', async () => {
    mockFetch({
      recommendations: [],
      starter: [
        { id: 'movie_1', externalId: '1', type: 'movie', title: 'Peli', poster: 'p' },
        { id: 'game_2', externalId: '2', type: 'game', title: 'Juego', poster: 'p' },
      ],
    })
    render(<AiRecommendations />)
    expect(await screen.findAllByTestId('card')).toHaveLength(2)
    expect(screen.getByText(/starterBadge/)).toBeInTheDocument()
    expect(screen.queryByText(/aiPickBadge/)).not.toBeInTheDocument()
    expect(screen.getByText('starterHint')).toBeInTheDocument()
    expect(screen.queryByText('needMoreItems')).not.toBeInTheDocument()
  })

  it('sin recomendaciones ni populares queda el aviso de añadir títulos', async () => {
    mockFetch({ recommendations: [] })
    render(<AiRecommendations />)
    expect(await screen.findByText('needMoreItems')).toBeInTheDocument()
  })
})
