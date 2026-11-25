// ============================================================
// Fase 8.5 · I1: Inicio en «Sala» (SALA_INICIO). El h1, «Continúa donde lo
// dejaste» con su «+1», «Popular entre tus amigos» (con su vacío) y las
// novedades; y lo que arregla de paso: filas con nombre, obras sin portada
// que ya no se esconden y la barra de la fila a la vista.
// ============================================================

import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '@/types/media'

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`
    t.has = () => true
    return t
  }
  return { useTranslations: make, useLocale: () => 'es' }
})
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
const mockFetch = vi.fn()
vi.mock('@/lib/api/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/client')>()),
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}))
// El «+1» (`SalaHomeProgress`, con su propio test): aquí un doble que dice para qué obra es.
vi.mock('@/components/home/sala/SalaHomeProgress', () => ({
  SalaHomeProgress: ({ title, variant }: { title: string; variant: string }) => (
    <button type="button" data-variant={variant}>
      +1 {title}
    </button>
  ),
}))

import { act, fireEvent } from '@testing-library/react'
import { SalaHomeCircle, SalaHomeContinue, SalaHomeHero, SalaHomeNews, SalaHomeTitle } from '@/components/home/sala/SalaHome'
import type { ContinueRowItem } from '@/components/home/ContinueRow'

const CONTINUE: ContinueRowItem[] = [
  { mediaId: 'manga_108556', title: '転生したらスライムだった件', poster: null, type: 'manga', status: 'in_progress', progress: null },
  { mediaId: 'movie_603', title: 'Matrix', poster: 'https://image.tmdb.org/t/p/w500/m.jpg', type: 'movie', status: 'pending', progress: null },
]

function media(i: number, extra: Partial<MediaItem> = {}): MediaItem {
  return { id: `movie_${i}`, externalId: String(i), type: 'movie', title: `Obra ${i}`, year: 2000 + i, poster: `https://x/${i}.jpg`, ...extra }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('SalaHomeTitle', () => {
  it('Inicio tiene su h1', () => {
    render(<SalaHomeTitle />)
    expect(screen.getByRole('heading', { level: 1, name: 'home.title' })).toBeInTheDocument()
  })
})

describe('SalaHomeContinue', () => {
  it('una lista nombrada por su h2, un enlace por obra (el título) y el «+1» fuera del enlace, después de él', () => {
    render(<SalaHomeContinue title="Continúa donde lo dejaste" items={CONTINUE} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Continúa donde lo dejaste' })
    const list = screen.getByRole('list', { name: 'Continúa donde lo dejaste' })
    expect(list.getAttribute('aria-labelledby')).toBe(heading.id)
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)

    const manga = items[0]
    const link = within(manga).getByRole('link', { name: '転生したらスライムだった件' })
    expect(link).toHaveAttribute('href', '/media/manga/108556')
    expect(within(manga).getByRole('heading', { level: 3 })).toHaveTextContent('転生したらスライムだった件')
    const plus = within(manga).getByRole('button', { name: '+1 転生したらスライムだった件' })
    expect(link.contains(plus)).toBe(false)
    expect(link.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // El formato, con palabras.
    expect(manga).toHaveTextContent('discoverFilters.typeBadge.manga')
    // Sin portada: el campo de color con el título, nunca una imagen rota.
    expect(manga.querySelector('img')).toBeNull()

    // Una película no tiene «+1»; su portada sí se pide.
    expect(within(items[1]).queryByRole('button')).toBeNull()
    expect(items[1].querySelector('img')).not.toBeNull()
  })

  it('la fila se desliza dentro de su caja, con la barra a la vista y sitio para el anillo de foco', () => {
    render(<SalaHomeContinue title="Continúa" items={CONTINUE} />)
    const list = screen.getByRole('list', { name: 'Continúa' })
    expect(list.className).toContain('overflow-x-auto')
    expect(list.className).not.toContain('scrollbar-hide')
    expect(list.className).toMatch(/\bpx-2\b/)
    expect(list.className).toMatch(/\bpt-2\b/)
  })

  it('sin obras no sale', () => {
    const { container } = render(<SalaHomeContinue title="Continúa" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SalaHomeCircle', () => {
  it('pide lo mismo que hoy, anuncia la carga y enseña también las obras sin portada', async () => {
    let resolve: (v: unknown) => void = () => undefined
    mockFetch.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<SalaHomeCircle />)
    expect(mockFetch).toHaveBeenCalledWith('/api/popular-in-circle', expect.objectContaining({ signal: expect.anything() }))
    const list = screen.getByRole('list', { name: 'home.popularInCircle' })
    expect(list).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('home.sala.loading'))

    resolve([
      { mediaId: 'movie_550', title: 'El club de la lucha', poster: null, type: 'movie', year: 1999, friendCount: 2, friendNames: [] },
      { mediaId: 'game_1', title: 'Elden Ring', poster: 'https://x/e.jpg', type: 'game', year: null, friendCount: 1, friendNames: [] },
    ])
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    expect(list).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('home.sala.results:{"count":2}'))
    expect(within(list).getByRole('link', { name: 'El club de la lucha' })).toHaveAttribute('href', '/media/movie/550')
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('1999')
    // I2a: cuántos amigos la tienen, en la línea de datos (plural ICU).
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('home.sala.friends:{"count":2}')
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('home.sala.friends:{"count":1}')
  })

  it('vacío: dice qué habrá aquí y lleva a Amigos', async () => {
    mockFetch.mockResolvedValue([])
    render(<SalaHomeCircle />)
    expect(await screen.findByRole('heading', { level: 3, name: 'home.noFriends' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'home.addFriends' })).toHaveAttribute('href', '/friends')
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('si falla, lo dice (role="alert") con «Reintentar», que vuelve a pedir y deja el foco en el encabezado', async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('x')))
    render(<SalaHomeCircle />)
    const alert = screen.getByRole('alert')
    const retry = await within(alert).findByRole('button', { name: 'home.sala.retry' })
    expect(alert).toHaveTextContent('home.sala.errorTitle:{"title":"home.popularInCircle"}')
    // El encabezado de la sección sigue: el aviso tiene dónde estar.
    const heading = screen.getByRole('heading', { level: 2, name: 'home.popularInCircle' })

    mockFetch.mockResolvedValueOnce([
      { mediaId: 'movie_550', title: 'El club de la lucha', poster: null, type: 'movie', year: 1999, friendCount: 3, friendNames: [] },
    ])
    fireEvent.click(retry)
    expect(heading).toHaveFocus()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const list = screen.getByRole('list', { name: 'home.popularInCircle' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })
})

describe('flechas de la fila', () => {
  /** jsdom no maqueta: se le dan medidas a la fila. */
  function size(list: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: clientWidth })
  }

  it('controlan la lista (aria-controls), se paran en los extremos con aria-disabled y no se llevan el foco', () => {
    const items: ContinueRowItem[] = Array.from({ length: 10 }, (_, i) => ({
      mediaId: `movie_${i}`, title: `Peli ${i}`, poster: null, type: 'movie', status: 'pending', progress: null,
    }))
    render(<SalaHomeContinue title="Continúa" items={items} />)
    const list = screen.getByRole('list', { name: 'Continúa' })
    const prev = screen.getByRole('button', { name: 'home.sala.prev:{"title":"Continúa"}' })
    const next = screen.getByRole('button', { name: 'home.sala.next:{"title":"Continúa"}' })
    expect(prev).toHaveAttribute('aria-controls', list.id)
    expect(next).toHaveAttribute('aria-controls', list.id)
    // Nunca `disabled`: una flecha enfocada que llega al final no pierde el foco.
    expect(prev).not.toBeDisabled()
    expect(next).not.toBeDisabled()

    // Sin nada que mover (todo cabe), las flechas no se ven pero guardan su sitio.
    const group = prev.parentElement!
    expect(group.className).toContain('invisible')

    size(list, { scrollWidth: 1600, clientWidth: 800 })
    const scrollBy = vi.fn()
    list.scrollBy = scrollBy as unknown as typeof list.scrollBy
    act(() => {
      list.scrollLeft = 0
      list.dispatchEvent(new Event('scroll'))
    })
    expect(prev).toHaveAttribute('aria-disabled', 'true')
    expect(next).not.toHaveAttribute('aria-disabled')
    expect(group.className).not.toContain('invisible')

    // Al principio, «Anteriores» no hace nada.
    fireEvent.click(prev)
    expect(scrollBy).not.toHaveBeenCalled()
    next.focus()
    fireEvent.click(next)
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 680 }))
    expect(next).toHaveFocus()

    // Al final, al revés; y el foco sigue en la flecha.
    act(() => {
      list.scrollLeft = 800
      list.dispatchEvent(new Event('scroll'))
    })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(prev).not.toHaveAttribute('aria-disabled')
    expect(next).toHaveFocus()
  })
})

describe('SalaHomeHero', () => {
  const HERO = {
    media_id: 'manga_108556',
    progress: { chapter: 34 },
    status: 'in_progress' as const,
    media: { id: 'manga_108556', title: 'Slime', poster: null, year: 2014, type: 'manga', synopsis: 'Una sinopsis.' },
  }

  it('«Continuando» dentro del h2, el formato con palabras, la sinopsis, el «+1» del hero y «Continuar» descrito por el título', () => {
    render(<SalaHomeHero item={HERO} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('home.continuing Slime')
    const section = screen.getByRole('region', { name: 'home.continuing Slime' })
    expect(section).toHaveTextContent('discoverFilters.typeBadge.manga')
    expect(section).toHaveTextContent('2014')
    expect(section).toHaveTextContent('Una sinopsis.')
    expect(screen.getByRole('button', { name: '+1 Slime' })).toHaveAttribute('data-variant', 'hero')
    const link = screen.getByRole('link', { name: 'home.continue' })
    expect(link).toHaveAttribute('href', '/media/manga/108556')
    expect(link).toHaveAttribute('aria-describedby', heading.id)
    // Sin portada: el campo de color con el título, nunca una imagen rota.
    expect(section.querySelector('img')).toBeNull()
  })

  it('el título de la obra es el rótulo (SalaTitleText), con su tope por debajo del h1', () => {
    render(<SalaHomeHero item={HERO} />)
    const rotulo = screen.getByRole('heading', { level: 2 }).querySelector('[data-sala-title-text]') as HTMLElement
    expect(rotulo).toHaveTextContent('Slime')
    expect(rotulo).toHaveClass('sala-type-title')
    expect(rotulo).toHaveClass('[--sala-title-cap:clamp(1.375rem,2.6vw,2.25rem)]', '[--sala-title-floor:1.375rem]')
  })

  it('sin nada en curso no sale; una película no lleva «+1»', () => {
    const { container, rerender } = render(<SalaHomeHero item={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<SalaHomeHero item={{ ...HERO, media: { ...HERO.media, type: 'movie', id: 'movie_603' } }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('SalaHomeNews', () => {
  it('con géneros: «Novedades en…» y «Series en…», ocho por fila y sin esconder las que no tienen portada', async () => {
    const movies = Array.from({ length: 10 }, (_, i) => media(i + 1, i === 0 ? { poster: undefined } : {}))
    const tv = [media(20, { id: 'tv_20', type: 'tv', title: 'Serie 20' })]
    mockFetch.mockResolvedValue({ movies, tv, genres: ['Drama', 'Comedia'] })
    render(<SalaHomeNews />)
    const first = await screen.findByRole('list', { name: 'home.genreNewsTitle:{"genre":"Drama"}' })
    await waitFor(() => expect(within(first).getAllByRole('listitem')).toHaveLength(8))
    expect(within(first).getByRole('link', { name: 'Obra 1' })).toBeInTheDocument()
    const second = screen.getByRole('list', { name: 'home.genreSeriesTitle:{"genre":"Comedia"}' })
    expect(within(second).getByRole('link', { name: 'Serie 20' })).toHaveAttribute('href', '/media/tv/20')
  })

  it('si falla: la fila de «Tendencias» con el aviso y «Reintentar»', async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('x')))
    render(<SalaHomeNews />)
    const alert = screen.getByRole('alert')
    await within(alert).findByRole('button', { name: 'home.sala.retry' })
    expect(alert).toHaveTextContent('home.sala.errorTitle:{"title":"home.trends"}')
    mockFetch.mockResolvedValueOnce({ movies: [media(1)], tv: [], genres: [] })
    fireEvent.click(within(alert).getByRole('button'))
    const row = screen.getByRole('list', { name: 'home.trends' })
    await waitFor(() => expect(within(row).getAllByRole('listitem')).toHaveLength(1))
  })

  it('sin géneros: una fila de «Tendencias»; vacío: nada', async () => {
    mockFetch.mockResolvedValue({ movies: [media(1)], tv: [media(2, { id: 'tv_2', type: 'tv' })], genres: [] })
    const { unmount } = render(<SalaHomeNews />)
    const row = await screen.findByRole('list', { name: 'home.trends' })
    await waitFor(() => expect(within(row).getAllByRole('listitem')).toHaveLength(2))
    unmount()

    mockFetch.mockResolvedValue({ movies: [], tv: [], genres: [] })
    const empty = render(<SalaHomeNews />)
    await waitFor(() => expect(empty.container).toBeEmptyDOMElement())
  })
})
