// ============================================================
// KULTURA — Inicio: HTML de la página (caracterización, fase 8.5 I1).
//
// Fija lo que pinta hoy `/home` en el servidor (aviso de borrado, hero,
// «Continúa donde lo dejaste», «Esta noche», «Para ti», actividad, «Popular
// entre tus amigos» y novedades, con su orden, sus Suspense y lo que recibe
// cada sección) para que la bandera `SALA_INICIO` apagada la deje EXACTAMENTE
// igual. La instantánea se sacó antes de tocar Inicio: si cambia, algo de
// «Sala» se ha colado. Las secciones son dobles que escriben sus props.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

const { state } = vi.hoisted(() => ({
  state: {
    signal: 5 as number,
    deletion: null as string | null,
    sala: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getTranslations: vi.fn(async (ns?: string) => (k: string, v?: Record<string, unknown>) =>
    `${ns}.${k}${v ? `(${Object.values(v).join(',')})` : ''}`),
}))
vi.mock('@/lib/claude/recommendations', () => ({
  MIN_LIBRARY_ITEMS: 3,
  readTodayAiRecommendations: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/recommendations/starter', () => ({ getStarterItems: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/media/hero-synopsis', () => ({ localizeHeroSynopsis: async (row: unknown) => row }))
vi.mock('@/lib/account/account-state', () => ({
  readAccountState: async () => ({ state: { deletion_requested_at: state.deletion } }),
}))

/** Doble de una sección: un `div` con su nombre y sus props. */
function stub(name: string) {
  return function Stub(props: Record<string, unknown>) {
    return <div data-stub={name} data-props={JSON.stringify(props)} />
  }
}
vi.mock('@/components/home/HeroSection', () => ({ HeroSection: stub('HeroSection') }))
vi.mock('@/components/home/ContinueRow', () => ({ ContinueRow: stub('ContinueRow') }))
vi.mock('@/components/home/AiRecommendations', () => ({ AiRecommendations: stub('AiRecommendations') }))
vi.mock('@/components/home/PopularInCircle', () => ({ PopularInCircle: stub('PopularInCircle') }))
vi.mock('@/components/home/GenreNews', () => ({ GenreNews: stub('GenreNews') }))
vi.mock('@/app/[locale]/(app)/home/sections', () => ({
  FriendsActivity: stub('FriendsActivity'),
  FriendsActivitySkeleton: stub('FriendsActivitySkeleton'),
  TonightOnMyPlatforms: stub('TonightOnMyPlatforms'),
  TonightSkeleton: stub('TonightSkeleton'),
}))
// Con «Sala» las piezas llegan por next/dynamic: aquí, dobles que guardan lo que reciben.
vi.mock('@/components/home/sala/SalaHomeLazy', () => {
  const lazy = (name: string) =>
    function SalaStub(props: Record<string, unknown>) {
      state.sala = { ...(state.sala ?? {}), [name]: props }
      return <div data-sala-stub={name} />
    }
  return {
    SalaHomeTitleLazy: lazy('title'),
    SalaHomeHeroLazy: lazy('hero'),
    SalaHomeContinueLazy: lazy('continue'),
    SalaHomeCircleLazy: lazy('circle'),
    SalaHomeNewsLazy: lazy('news'),
  }
})

const NO_PROGRESS = {
  progress_season: null, progress_episode: null, progress_chapter: null, progress_volume: null,
  progress_page: null, progress_percent: null, progress_hours: null, progress_total: null,
}
const HERO_ROW = {
  media_id: 'book_1',
  ...NO_PROGRESS,
  progress_page: 120,
  progress_total: 300,
  media: { id: 'book_1', title: 'Libro', poster: null, year: 2020, type: 'book', synopsis: 'Sinopsis' },
}
const RECENT_ROWS = [
  { ...HERO_ROW, status: 'in_progress' },
  {
    media_id: 'manga_2',
    status: 'in_progress',
    ...NO_PROGRESS,
    progress_chapter: 42,
    media: { id: 'manga_2', title: 'Manga', poster: 'https://x/p.jpg', type: 'manga' },
  },
  { media_id: 'game_3', status: 'pending', ...NO_PROGRESS, media: { id: 'game_3', title: 'Juego', poster: null, type: 'game' } },
]

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@b.c' } } }) },
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'user-1' } }) }) }) }
      }
      return {
        select: (_cols: string, opts?: { head?: boolean }) => {
          const chain: Record<string, unknown> = {}
          chain.eq = () => chain
          chain.in = () => chain
          chain.order = () => chain
          chain.limit = () =>
            opts?.head ? chain : Object.assign(Promise.resolve({ data: RECENT_ROWS }), { maybeSingle: async () => ({ data: HERO_ROW }) })
          chain.or = async () => ({ count: state.signal, error: null })
          return chain
        },
      }
    },
  }),
}))

async function renderHome(): Promise<string> {
  const { default: HomePage } = await import('@/app/[locale]/(app)/home/page')
  return renderToStaticMarkup((await HomePage()) as ReactElement)
}

beforeEach(() => {
  state.signal = 5
  state.deletion = null
  state.sala = null
  delete process.env.SALA_INICIO
})
afterEach(() => {
  delete process.env.SALA_INICIO
})

describe('Inicio sin «Sala» (SALA_INICIO apagada): marcado de hoy', () => {
  it('cuenta con señal: hero, continuar y todas las secciones', async () => {
    expect(await renderHome()).toMatchSnapshot()
    expect(state.sala).toBeNull()
  })

  it('cuenta sin señal y borrado programado: aviso arriba y lo popular en su Suspense', async () => {
    state.signal = 1
    state.deletion = '2026-11-01T10:00:00.000Z'
    expect(await renderHome()).toMatchSnapshot()
    expect(state.sala).toBeNull()
  })

  it('con SALA_INICIO=0 tampoco hay «Sala»', async () => {
    process.env.SALA_INICIO = '0'
    const html = await renderHome()
    expect(html).not.toContain('data-sala')
    expect(state.sala).toBeNull()
  })
})

describe('Inicio con «Sala» (SALA_INICIO=1)', () => {
  it('el h1, el hero y las filas de «Sala» sustituyen a los de hoy; el resto sigue igual y en el mismo orden', async () => {
    process.env.SALA_INICIO = '1'
    state.deletion = '2026-11-01T10:00:00.000Z'
    const html = await renderHome()
    // Lo que se queda como hoy (I2b) y lo que pasa a «Sala», en orden.
    const order = [...html.matchAll(/data-(?:sala-)?stub="([^"]+)"|role="status"/g)].map((m) => m[1] ?? 'aviso')
    expect(order).toEqual([
      'title',
      'aviso',
      'hero',
      'continue',
      'TonightOnMyPlatforms',
      'AiRecommendations',
      'FriendsActivity',
      'circle',
      'news',
    ])
    expect(html).toContain('<main data-sala-home=""')
    expect(html).not.toContain('data-stub="HeroSection"')
    expect(html).not.toContain('data-stub="ContinueRow"')
    expect(html).not.toContain('data-stub="PopularInCircle"')
    expect(html).not.toContain('data-stub="GenreNews"')
    // El hero recibe la misma fila que hoy `HeroSection`, con su progreso.
    expect(state.sala?.hero).toEqual({
      item: expect.objectContaining({
        media_id: 'book_1',
        progress: expect.objectContaining({ page: 120 }),
        media: expect.objectContaining({ title: 'Libro', synopsis: 'Sinopsis' }),
      }),
    })
    // «Continúa» recibe las mismas filas que hoy (sin la del hero).
    expect(state.sala?.continue).toEqual({
      title: 'home.continueWatching',
      items: [
        { mediaId: 'manga_2', title: 'Manga', poster: 'https://x/p.jpg', type: 'manga', status: 'in_progress', progress: expect.anything() },
        { mediaId: 'game_3', title: 'Juego', poster: null, type: 'game', status: 'pending', progress: null },
      ],
    })
  })
})
