// ============================================================
// KULTURA — /u/[username]: HTML de la página (caracterización, fase 8.5 P3).
//
// Fija lo que pinta hoy el perfil público en el servidor (barra, invitación,
// cabecera, acciones según quién mira, biblioteca o su bloqueo, listas por
// formato, llamada a registrarse y denuncia sin cuenta, con su orden y lo que
// recibe cada pieza) para que la bandera `SALA_PERFIL` apagada lo deje
// EXACTAMENTE igual. La instantánea se sacó antes de tocar la página: si
// cambia, algo de «Sala» se ha colado. Las piezas son dobles que escriben sus
// props.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

const GOOD = '1790000000.' + 'a'.repeat(32)

type Scenario = {
  viewer: string | null
  canRead: boolean
  visibility: 'public' | 'friends' | 'private'
  lists: boolean
  query?: Record<string, string>
}

const h = vi.hoisted(() => ({
  s: null as unknown as Scenario,
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getTranslations: vi.fn(async (ns?: unknown) => (k: string, v?: Record<string, unknown>) =>
    `${typeof ns === 'string' ? ns : 'x'}.${k}${v ? `(${Object.values(v).join(',')})` : ''}`),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

/** Doble de una pieza: un `div` con su nombre y sus props. */
function stub(name: string) {
  return function Stub({ children, actions, ...props }: Record<string, unknown>) {
    return (
      <div data-stub={name} data-props={JSON.stringify(props)}>
        {actions as ReactNode}
        {children as ReactNode}
      </div>
    )
  }
}
vi.mock('@/components/collection/PublicCollection', () => ({
  CollectionOwner: stub('CollectionOwner'),
  FavoritesGrid: stub('FavoritesGrid'),
  FormatCounters: stub('FormatCounters'),
  FormatLabel: stub('FormatLabel'),
  InviteBanner: stub('InviteBanner'),
  LockedLibrary: stub('LockedLibrary'),
  PublicListRow: stub('PublicListRow'),
  SignUpCta: stub('SignUpCta'),
  SignedInBar: stub('SignedInBar'),
  WatchingRow: stub('WatchingRow'),
  PLURAL_KEY: { movie: 'movies', tv: 'tvs', anime: 'animes', manga: 'mangas', book: 'books', comic: 'comics', game: 'games' },
}))
vi.mock('@/components/collection/InviteLinkButton', () => ({ InviteLinkButton: stub('InviteLinkButton') }))
vi.mock('@/components/social/ReportButton', () => ({ ReportButton: stub('ReportButton') }))
vi.mock('@/components/ui/KButton', () => ({ KButton: stub('KButton') }))
vi.mock('@/components/layout/Header', () => ({ Header: stub('Header') }))
vi.mock('@/components/layout/Footer', () => ({ Footer: stub('Footer') }))
vi.mock('@/lib/analytics/invite', () => ({
  invitePath: (locale: string, u: { username: string }) => `/${locale}/u/${u.username}?ref=${u.username}&inv=firma`,
  isValidInviteSignature: (_id: string, ref?: string, sig?: string) => ref === 'benevi' && sig === GOOD,
}))

const OWNER = {
  id: 'owner-1', username: 'benevi', avatarColor: 'orange', avatarInitials: 'BE', avatarIcon: null, bio: 'Mi bio',
  createdAt: null, libraryVisibility: null,
}
const item = (mediaId: string, title: string, poster: string | null) => ({ mediaId, title, poster, type: mediaId.split('_')[0], year: 2020 })
const SHOWCASE = {
  total: 3,
  completed: 1,
  byFormat: [{ type: 'movie', count: 2 }, { type: 'manga', count: 1 }],
  favorites: [{ ...item('movie_1', 'Peli', 'https://x/p.jpg'), score: 4.5, rating10: 9 }],
  watching: [item('manga_2', 'Manga', null)],
}
const LISTS = [
  { id: 'l1', name: 'Pelis', mediaType: 'movie', items: [item('movie_1', 'Peli', null)] },
  { id: 'l2', name: 'Juegos', mediaType: 'game', items: [item('game_3', 'Juego', null)] },
]

vi.mock('@/lib/social/public-collection', () => ({
  getPublicCollection: vi.fn(async () => ({ owner: { ...OWNER }, lists: h.s.lists ? LISTS : [] })),
  getLibraryShowcase: vi.fn(async () => SHOWCASE),
  getOwnerDetails: vi.fn(async () => ({ createdAt: '2026-10-01T10:00:00.000Z', libraryVisibility: h.s.visibility })),
  viewerCanReadLibrary: vi.fn(async () => h.s.canRead),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.s.viewer ? { id: h.s.viewer, user_metadata: {} } : null } }) },
  }),
}))

type El = ReactElement<Record<string, unknown>>

/** Mini render de servidor: ejecuta los componentes async antes de pasarlo a HTML. */
async function expand(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(expand))
  if (!isValidElement(node)) return node
  const el = node as El
  if (typeof el.type === 'function' && el.type.constructor.name === 'AsyncFunction') {
    return expand(await (el.type as (p: unknown) => Promise<ReactNode>)(el.props))
  }
  const props: Record<string, unknown> = { ...el.props }
  for (const key of ['children', 'actions']) {
    if (key in props) props[key] = await expand(props[key] as ReactNode)
  }
  return { ...el, props } as ReactNode
}

async function renderPage(): Promise<string> {
  const { default: Page } = await import('@/app/[locale]/u/[username]/page')
  const page = await Page({
    params: Promise.resolve({ locale: 'es', username: 'benevi' }),
    searchParams: Promise.resolve(h.s.query ?? {}),
  })
  return renderToStaticMarkup((await expand(page)) as ReactElement)
}

const SCENARIOS: Record<string, Scenario> = {
  anonimo: { viewer: null, canRead: false, visibility: 'public', lists: true },
  invitacion: { viewer: null, canRead: false, visibility: 'public', lists: true, query: { ref: 'benevi', inv: GOOD, utm_source: 'reddit' } },
  'anonimo-sin-listas': { viewer: null, canRead: false, visibility: 'public', lists: false },
  'con-sesion': { viewer: 'viewer-1', canRead: true, visibility: 'public', lists: true },
  'solo-amigos': { viewer: 'viewer-1', canRead: false, visibility: 'friends', lists: true },
  privada: { viewer: 'viewer-1', canRead: false, visibility: 'private', lists: false },
  propio: { viewer: 'owner-1', canRead: true, visibility: 'public', lists: false },
}

beforeEach(() => {
  delete process.env.SALA_PERFIL
})
afterEach(() => {
  delete process.env.SALA_PERFIL
})

describe('/u sin «Sala» (SALA_PERFIL apagada): marcado de hoy', () => {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    it(name, async () => {
      h.s = scenario
      const html = await renderPage()
      expect(html).toMatchSnapshot()
      expect(html).not.toContain('data-sala')
    })
  }

  it('con SALA_PERFIL=0 tampoco hay «Sala»', async () => {
    process.env.SALA_PERFIL = '0'
    h.s = SCENARIOS['con-sesion']
    expect(await renderPage()).not.toContain('data-sala')
  })
})
