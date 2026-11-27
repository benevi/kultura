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
  /** Bloqueo entre quien mira y el dueño (en cualquier sentido). */
  blocked?: boolean
}

const h = vi.hoisted(() => ({
  s: null as unknown as Scenario,
  ownerScale: 'ten' as string,
  calls: [] as string[],
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
  return function Stub({ children, actions, action, ...props }: Record<string, unknown>) {
    return (
      <div data-stub={name} data-props={JSON.stringify(props)}>
        {actions as ReactNode}
        {action as ReactNode}
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
// «Sala» (P3): la sesión con su perfil, los avisos, la escala del dueño y las piezas.
vi.mock('@/lib/media/viewer', () => ({
  getViewer: vi.fn(async () => {
    h.calls.push('getViewer')
    return h.s.viewer
      ? { user: { id: h.s.viewer, user_metadata: { rating_scale: 'ten' } }, profile: { username: 'yo', avatar_color: 'pink', avatar_initials: 'YO' } }
      : { user: null, profile: null }
  }),
}))
vi.mock('@/lib/social/notifications', () => ({ getUnreadCount: vi.fn(async () => 3) }))
vi.mock('@/lib/share/rating-share', () => ({
  ownerShareScale: vi.fn(async () => {
    h.calls.push('ownerShareScale')
    return h.ownerScale
  }),
}))
vi.mock('@/components/layout/AppChromeLazy', () => ({ AppChromeLazy: stub('AppChrome') }))
vi.mock('@/components/layout/AppFooter', () => ({ AppFooter: stub('AppFooter') }))
vi.mock('@/i18n/ClientMessages', () => ({ ClientMessages: stub('ClientMessages') }))
vi.mock('@/components/sala/SalaLink', () => ({ SalaLink: stub('SalaLink') }))
vi.mock('@/components/profile/sala/SalaProfilePublicLazy', () => ({
  SalaProfileHeaderLazy: stub('header'),
  SalaProfileEditLazy: stub('edit'),
  SalaProfileNumbersLazy: stub('numbers'),
  SalaProfileRowLazy: stub('row'),
  SalaProfileStateLazy: stub('state'),
  SalaProfileFavoritesLazy: stub('favorites'),
  SalaProfileInviteLazy: stub('invite'),
  SalaProfileCtaLazy: stub('cta'),
  SalaProfileLinkButtonLazy: stub('link-button'),
}))
vi.mock('@/lib/social/block-check', () => ({
  viewerBlockedWith: vi.fn(async (_c: unknown, viewerId: string | null, ownerId: string) =>
    Boolean(viewerId && viewerId !== ownerId && h.s.blocked)),
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
  h.calls = []
  h.ownerScale = 'ten'
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
    expect(h.calls).toEqual([])
  })
})

/** Las piezas en orden, con sus props. */
function pieces(html: string): Array<{ name: string; props: Record<string, unknown> }> {
  return [...html.matchAll(/data-stub="([^"]+)" data-props="([^"]*)"/g)].map((m) => ({
    name: m[1],
    props: JSON.parse(m[2].replace(/&quot;/g, '"').replace(/&amp;/g, '&')),
  }))
}
const names = (html: string) => pieces(html).map((p) => p.name)
const props = (html: string, name: string) => pieces(html).filter((p) => p.name === name).map((p) => p.props)

describe('/u con «Sala» (SALA_PERFIL=1)', () => {
  beforeEach(() => {
    process.env.SALA_PERFIL = '1'
  })

  it('anónimo: cabecera pública, sin fecha de alta ni biblioteca; el bloqueo solo con «Ya tengo cuenta» y una llamada al final', async () => {
    h.s = SCENARIOS.anonimo
    const html = await renderPage()
    expect(html).toContain('data-sala-profile="public"')
    expect(names(html)).toEqual(['Header', 'header', 'state', 'link-button', 'row', 'SalaLink', 'row', 'SalaLink', 'cta', 'SalaLink', 'Footer'])
    // Privacidad (§7, R2): sin sesión no hay fecha, ni visibilidad, ni biblioteca.
    expect(props(html, 'header')[0]).toMatchObject({ username: 'benevi', memberSince: null, bio: 'Mi bio' })
    expect(html).not.toContain('2026')
    expect(html).not.toContain('statsLabel')
    expect(html).not.toContain('favorites')
    expect(h.calls).not.toContain('ownerShareScale')
    const [locked] = props(html, 'state')
    expect(locked).toMatchObject({ name: 'locked', title: 'collection.lockedTitle(benevi)' })
    expect(props(html, 'link-button')).toEqual([{ href: '/login?mode=login&ref=benevi' }])
    expect(props(html, 'cta')[0]).toMatchObject({ href: '/login?mode=register&ref=benevi' })
    // Una sola llamada a registrarse.
    expect(html.match(/mode=register/g)).toHaveLength(1)
    expect(props(html, 'SalaLink').map((l) => l.href)).toEqual(['/u/benevi/l/l1', '/u/benevi/l/l2', '/report?target=user&id=benevi'])
  })

  it('anónimo con invitación: la invitación es la única llamada a registrarse', async () => {
    h.s = SCENARIOS.invitacion
    const html = await renderPage()
    const order = names(html)
    expect(order.slice(0, 2)).toEqual(['Header', 'invite'])
    expect(order).not.toContain('cta')
    expect(props(html, 'invite')[0]).toMatchObject({
      title: 'invite.bannerTitle(benevi)',
      text: 'invite.bannerFriends',
      href: `/login?mode=register&utm_source=reddit&ref=benevi&inv=${GOOD}`,
    })
    expect(html.match(/mode=register/g)).toHaveLength(1)
  })

  it('con sesión: la barra de la app (con los textos del shell), fecha de alta, números en minúscula y favoritos en la escala del dueño', async () => {
    h.s = SCENARIOS['con-sesion']
    const html = await renderPage()
    const order = names(html)
    expect(order.slice(0, 3)).toEqual(['ClientMessages', 'AppChrome', 'ClientMessages'])
    expect(order).not.toContain('Header')
    expect(order).not.toContain('Footer')
    expect(order).not.toContain('cta')
    expect(props(html, 'ClientMessages').map((p) => (p.namespaces as string[]).includes('nav'))).toEqual([true, false])
    expect(props(html, 'AppChrome')[0]).toMatchObject({ userId: 'viewer-1', unreadCount: 3, demo: false, profile: { username: 'yo' } })
    expect(String(props(html, 'header')[0].memberSince)).toContain('collection.memberSince(')
    expect(props(html, 'numbers')[0].items).toEqual([
      { value: 3, label: 'profile.totalItems(3)' },
      { value: 1, label: 'profile.completed(1)' },
      { value: 2, label: 'media.movies' },
      { value: 1, label: 'media.manga' },
    ])
    const [fav] = props(html, 'favorites')
    expect(fav).toMatchObject({ priority: true, hint: null })
    expect((fav.items as Array<Record<string, unknown>>)[0]).toMatchObject({ mediaId: 'movie_1', year: 2020, detail: 'collection.favoriteRating(ten,9)' })
    expect(h.calls).toContain('ownerShareScale')
    expect(props(html, 'link-button')).toEqual([{ href: '/profile/benevi' }])
    expect(props(html, 'ReportButton')[0]).toMatchObject({ targetType: 'user', targetId: 'owner-1', skin: 'sala', closeLabel: 'common.close' })
    expect(props(html, 'SalaLink').map((l) => l.href)).not.toContain('/report?target=user&id=benevi')
  })

  it('favoritos de quien puntúa con estrellas: «4,5 de 5»', async () => {
    h.s = SCENARIOS['con-sesion']
    h.ownerScale = 'stars'
    const [fav] = props(await renderPage(), 'favorites')
    expect((fav.items as Array<Record<string, unknown>>)[0].detail).toBe('collection.favoriteRating(stars,4,5)')
  })

  it('solo amigos y privada: el bloqueo con sesión, sin botones', async () => {
    h.s = SCENARIOS['solo-amigos']
    const friends = props(await renderPage(), 'state')[0]
    expect(friends).toMatchObject({ name: 'hidden', description: 'profile.libraryHiddenFriends' })
    // «Ver su perfil y añadirle» una sola vez (en la cabecera), no también en el bloqueo.
    expect(props(await renderPage(), 'link-button')).toEqual([{ href: '/profile/benevi' }])
    h.s = SCENARIOS.privada
    const html = await renderPage()
    expect(props(html, 'state')[0]).toMatchObject({ name: 'hidden', description: 'profile.libraryHiddenPrivate' })
    expect(props(html, 'state')[1]).toMatchObject({ name: 'lists-empty', title: 'collection.empty(benevi)' })
  })

  it('con un bloqueo entre los dos: solo la cabecera, sin biblioteca ni listas', async () => {
    h.s = { ...SCENARIOS['con-sesion'], blocked: true }
    const html = await renderPage()
    expect(props(html, 'header')[0]).toMatchObject({ username: 'benevi' })
    expect(names(html)).not.toContain('numbers')
    expect(names(html)).not.toContain('favorites')
    expect(names(html)).not.toContain('row')
    expect(props(html, 'SalaLink').map((l) => l.href)).not.toContain('/u/benevi/l/l1')
    expect(props(html, 'state')[0]).toMatchObject({ name: 'hidden' })
    expect(props(html, 'state')[1]).toMatchObject({ name: 'lists-empty' })
  })

  it('el dueño: invitar con «Sala», «Editar perfil», nota de visibilidad y su escala sin pedirla al servidor', async () => {
    h.s = SCENARIOS.propio
    const html = await renderPage()
    expect(props(html, 'InviteLinkButton')[0]).toEqual({ path: '/es/u/benevi?ref=benevi&inv=firma', skin: 'sala' })
    expect(props(html, 'edit')[0]).toEqual({ label: 'profile.editProfile' })
    expect(html).toContain('data-sala-profile-owner-note=""')
    expect(props(html, 'SalaLink').map((l) => l.href)).toEqual(['/settings'])
    expect(h.calls).not.toContain('ownerShareScale')
    const [fav] = props(html, 'favorites')
    expect(fav.hint).toBe('collection.favoritesHint')
    expect((fav.items as Array<Record<string, unknown>>)[0].detail).toBe('collection.favoriteRating(ten,9)')
    expect(props(html, 'state')[0]).toMatchObject({ name: 'lists-empty', title: 'collection.emptyOwn' })
  })
})
