// ============================================================
// KULTURA — Inicio en «Sala», I2b-2: «Para ti», «Esta noche» y la actividad.
// «Para ti» se comporta como `AiRecommendations` (nada se pide al montar, la
// misma línea de privacidad con su enlace, error y límite con «Reintentar»);
// «Sorpréndeme» elige y lo anuncia sin mover el foco; la actividad enseña sus
// tres estados.
// ============================================================

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next-intl', () => {
  const t = (key: string, v?: Record<string, unknown>) => (v ? `${key}(${Object.values(v).join('|')})` : key)
  t.rich = (key: string, v: Record<string, unknown>) => key + String(v.user)
  return { useTranslations: vi.fn(() => t), useLocale: () => 'es' }
})
vi.mock('@/components/sala/SalaWorkCard', () => ({
  SalaWorkCard: ({ title, href, detail }: { title: string; href: string; detail?: string }) => (
    <a data-testid="card" href={href}>{title}{detail ? ` · ${detail}` : ''}</a>
  ),
  SalaWorkCardSkeleton: () => <div data-testid="skeleton" />,
}))
vi.mock('@/components/sala/SalaPoster', () => ({ SalaPoster: () => <div data-testid="poster" /> }))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <span data-testid="avatar" /> }))

import { SalaHomeForYou } from '@/components/home/sala/SalaHomeForYou'
import { SalaHomeTonight, SalaHomeTonightSetup } from '@/components/home/sala/SalaHomeTonight'
import { SalaHomeActivity, type SalaActivityEntry } from '@/components/home/sala/SalaHomeActivity'

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: new Headers(),
    json: async () => (status < 400 ? { data: body } : body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const REC = {
  item: { id: 'movie_1', externalId: '1', type: 'movie', title: 'Peli', poster: 'p', genres: ['Drama'] },
  matchScore: 80,
  reason: 'Mismo tono que tus favoritas.',
}

afterEach(() => vi.unstubAllGlobals())

describe('«Para ti» en «Sala»', () => {
  it('no pide nada al montar; el botón, la misma línea de privacidad y el enlace a /privacy', () => {
    const fetchMock = mockFetch({ recommendations: [REC], source: 'ai' })
    render(<SalaHomeForYou />)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2, name: 'title' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'askButton' })).toBeInTheDocument()
    expect(screen.getByText('askPrivacy', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacyLink' })).toHaveAttribute('href', '/privacy')
    expect(screen.queryByTestId('card')).not.toBeInTheDocument()
  })

  it('al pulsar pide una vez, pinta las obras con su porqué y el foco va al h2', async () => {
    const fetchMock = mockFetch({ recommendations: [REC], source: 'ai' })
    render(<SalaHomeForYou />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    expect(await screen.findAllByTestId('card')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai-recommendations')
    expect(screen.getByTestId('card')).toHaveAttribute('href', '/media/movie/1')
    expect(screen.getByText('Mismo tono que tus favoritas.')).toBeInTheDocument()
    expect(screen.getByText('aiPickBadge')).toBeInTheDocument()
    expect(screen.getByText('dailyNote')).toBeInTheDocument()
    // El foco llega en un efecto después de pintar: con la suite cargada, un tick más tarde (docs/tests-intermitentes.md).
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'title' })).toHaveFocus())
  })

  it('con las de hoy (initial) las pinta sin pedir', () => {
    const fetchMock = mockFetch({})
    render(<SalaHomeForYou initial={{ recommendations: [REC as never], source: 'match' }} />)
    expect(screen.getAllByTestId('card')).toHaveLength(1)
    expect(screen.getByText('matchBadge')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('error: aviso en la región de alerta con «Reintentar», que vuelve a pedir', async () => {
    const fetchMock = mockFetch({ error: { code: 'internal' } }, 500)
    render(<SalaHomeForYou />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    const retry = await screen.findByRole('button', { name: 'retry' })
    expect(screen.getByRole('alert')).toHaveTextContent('error')
    expect(screen.getByRole('alert')).toHaveTextContent('tryAgainLater')
    fireEvent.click(retry)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('límite (429): lo dice y deja reintentar', async () => {
    mockFetch({ error: { code: 'rate_limited' } }, 429)
    render(<SalaHomeForYou />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    await screen.findByRole('button', { name: 'retry' })
    expect(screen.getByRole('alert')).toHaveTextContent('rateLimited')
  })

  it('vacío: el estado de bloque con la salida a Descubrir', async () => {
    mockFetch({ recommendations: [], starter: [] })
    render(<SalaHomeForYou />)
    fireEvent.click(screen.getByRole('button', { name: 'askButton' }))
    expect(await screen.findByText('needMoreItems')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'exploreContent' })).toHaveAttribute('href', '/discover')
  })

  it('lo popular (starter) sin botón ni petición', () => {
    const fetchMock = mockFetch({})
    render(<SalaHomeForYou starter={[REC.item as never]} />)
    expect(screen.getAllByTestId('card')).toHaveLength(1)
    expect(screen.getByText('starterBadge')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'askButton' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

const PICKS = [
  { mediaId: 'movie_1', title: 'Uno', poster: null, type: 'movie', platforms: ['Netflix'] },
  { mediaId: 'tv_2', title: 'Dos', poster: null, type: 'tv', platforms: ['Max'] },
]

describe('«Esta noche» en «Sala»', () => {
  it('«Sorpréndeme» elige una, lo anuncia y el foco se queda en el botón', () => {
    render(<SalaHomeTonight picks={PICKS} platforms={['Netflix', 'Max']} />)
    expect(screen.getAllByTestId('card')).toHaveLength(2)
    const button = screen.getByRole('button', { name: 'surprise' })
    button.focus()
    act(() => fireEvent.click(button))
    expect(screen.getAllByRole('status').find((el) => el.textContent?.startsWith('surprisePick'))).toHaveTextContent(/surprisePick\((Uno\|Netflix|Dos\|Max)\)/)
    expect(screen.getAllByTestId('card')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'surpriseAgain' })).toHaveFocus()
  })

  it('sin nada esta noche: estado de bloque con la salida a Ajustes y sin «Sorpréndeme»', () => {
    render(<SalaHomeTonight picks={[]} platforms={['Netflix']} />)
    expect(screen.queryByRole('button', { name: 'surprise' })).not.toBeInTheDocument()
    expect(screen.getByText('tonightEmpty')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'editPlatforms' })).toHaveAttribute('href', '/settings#platforms')
  })

  it('sin plataformas: su h2 y la salida a Ajustes', () => {
    render(<SalaHomeTonightSetup />)
    expect(screen.getByRole('heading', { level: 2, name: 'tonightTitle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'tonightSetupCta' })).toHaveAttribute('href', '/settings#platforms')
  })
})

const ENTRY: SalaActivityEntry = {
  id: 'e1',
  status: 'completed',
  username: 'lucia',
  avatarInitials: 'LU',
  avatarColor: 'blue',
  mediaId: 'movie_603',
  mediaTitle: 'Matrix',
  mediaPoster: null,
  href: '/media/movie/603',
  score: 4,
  updatedAt: '2026-11-25T10:00:00.000Z',
  when: 'hace 2 horas',
}

describe('Actividad de amigos en «Sala»', () => {
  it('lista con nombre, la nota y la fecha', () => {
    render(<SalaHomeActivity entries={[ENTRY]} state="list" />)
    const list = screen.getByRole('list', { name: 'recentActivity' })
    expect(list.querySelectorAll('li')).toHaveLength(1)
    expect(list).toHaveTextContent('activityScore(4)')
    expect(list.querySelector('time')).toHaveAttribute('dateTime', ENTRY.updatedAt)
  })

  it('sin amigos: el estado de bloque y la salida a Amigos', () => {
    render(<SalaHomeActivity entries={[]} state="no-friends" />)
    expect(screen.getByText('noFriends')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'addFriends' })).toHaveAttribute('href', '/friends')
  })

  it('sin actividad: el estado de bloque, sin salida', () => {
    render(<SalaHomeActivity entries={[]} state="no-activity" />)
    expect(screen.getByText('noActivity')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
