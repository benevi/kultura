import { render, screen, fireEvent } from '@testing-library/react'
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

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

const REC = {
  item: { id: 'movie_1', externalId: '1', type: 'movie', title: 'Peli', poster: 'p', genres: ['Drama'] },
  matchScore: 80,
  reason: 'Mismo tono que tus favoritas.',
}

afterEach(() => vi.unstubAllGlobals())

describe('AiRecommendations — sin llamada al montar (D-06)', () => {
  it('no hace fetch hasta el clic: enseña el botón y qué se envía a quién', () => {
    const fetchMock = mockFetch({ recommendations: [REC], source: 'ai' })
    render(<AiRecommendations />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'askButton' })).toBeInTheDocument()
    expect(screen.getByText('askPrivacy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacyLink' })).toHaveAttribute('href', '/privacy')
    expect(screen.queryByTestId('card')).not.toBeInTheDocument()
  })

  it('al pulsar "Recomiéndame" pide una vez y pinta las recomendaciones', async () => {
    const fetchMock = mockFetch({ recommendations: [REC], source: 'ai' })
    render(<AiRecommendations />)

    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))

    expect(await screen.findAllByTestId('card')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai-recommendations')
    expect(screen.getByText('Mismo tono que tus favoritas.')).toBeInTheDocument()
    expect(screen.getByText(/aiPickBadge/)).toBeInTheDocument()
    expect(screen.getByText('dailyNote')).toBeInTheDocument()
  })

  it('con las de hoy ya generadas (initial) las pinta sin fetch', () => {
    const fetchMock = mockFetch({})
    render(<AiRecommendations initial={{ recommendations: [REC as never], source: 'ai' }} />)

    expect(screen.getAllByTestId('card')).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'askButton' })).not.toBeInTheDocument()
  })

  it('con el tope diario alcanzado lo dice y no se atribuye a la IA', async () => {
    mockFetch({ recommendations: [{ ...REC, reason: undefined }], source: 'match', capped: true })
    render(<AiRecommendations />)

    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))

    expect(await screen.findByText('cappedNote')).toBeInTheDocument()
    expect(screen.getByText(/matchBadge/)).toBeInTheDocument()
    expect(screen.queryByText(/aiPickBadge/)).not.toBeInTheDocument()
    // Sin frase del modelo, el porqué localizado a partir de los géneros.
    expect(screen.getByText('whyRecommendedText')).toBeInTheDocument()
  })

  it('un 429 deja reintentar con el mismo botón de siempre', async () => {
    const fetchMock = mockFetch({ error: 'Too many requests' }, 429)
    render(<AiRecommendations />)

    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    fireEvent.click(await screen.findByRole('button', { name: 'retry' }))

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('AiRecommendations — cuenta nueva', () => {
  it('con lo popular del servidor lo enseña directamente, sin botón ni fetch', () => {
    const fetchMock = mockFetch({})
    render(
      <AiRecommendations
        starter={[
          { id: 'movie_1', externalId: '1', type: 'movie', title: 'Peli', poster: 'p' },
          { id: 'game_2', externalId: '2', type: 'game', title: 'Juego', poster: 'p' },
        ]}
      />
    )
    expect(screen.getAllByTestId('card')).toHaveLength(2)
    expect(screen.getByText(/starterBadge/)).toBeInTheDocument()
    expect(screen.queryByText(/aiPickBadge/)).not.toBeInTheDocument()
    expect(screen.getByText('starterHint')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('si tras el clic no hay recomendaciones, enseña lo popular con su propio cartel', async () => {
    mockFetch({
      recommendations: [],
      source: 'match',
      starter: [
        { id: 'movie_1', externalId: '1', type: 'movie', title: 'Peli', poster: 'p' },
        { id: 'game_2', externalId: '2', type: 'game', title: 'Juego', poster: 'p' },
      ],
    })
    render(<AiRecommendations />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))

    expect(await screen.findAllByTestId('card')).toHaveLength(2)
    expect(screen.getByText(/starterBadge/)).toBeInTheDocument()
    expect(screen.queryByText('needMoreItems')).not.toBeInTheDocument()
  })

  it('sin recomendaciones ni populares queda el aviso de añadir títulos', async () => {
    mockFetch({ recommendations: [] })
    render(<AiRecommendations />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    expect(await screen.findByText('needMoreItems')).toBeInTheDocument()
  })
})
