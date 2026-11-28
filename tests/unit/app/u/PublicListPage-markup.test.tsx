// ============================================================
// KULTURA — /u/[username]/l/[id]: HTML de la página (caracterización, fase 8.5 L5).
//
// Fija lo que pinta hoy la lista pública en el servidor (sin sesión, con
// sesión, un «Ranking personal» con su orden y sus notas, una lista sin datos
// extra; el 404 por bloqueo y los metadatos) para que la bandera
// `SALA_LISTAS` apagada lo deje EXACTAMENTE igual. Las piezas de cliente son
// dobles que escriben sus props (su HTML ya lo fijan sus propios tests).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement, ReactNode } from 'react'

const { state } = vi.hoisted(() => ({
  state: {
    user: null as { id: string } | null,
    list: null as unknown,
    extras: null as unknown,
    blocked: false,
    profile: null as Record<string, unknown> | null,
    sala: null as Record<string, unknown> | null,
    chrome: null as Record<string, unknown> | null,
    calls: [] as string[],
  },
}))

function stub(name: string) {
  return function Stub({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
    return (
      <div data-stub={name} data-props={JSON.stringify(props)}>
        {children}
      </div>
    )
  }
}

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (opts?: string | { namespace?: string }) => {
    const ns = typeof opts === 'string' ? opts : opts?.namespace
    return (k: string, v?: Record<string, unknown>) => `${ns}.${k}${v ? JSON.stringify(v) : ''}`
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } })),
}))
vi.mock('@/lib/social/public-collection', () => ({ getPublicList: vi.fn(async () => state.list) }))
vi.mock('@/lib/social/block-check', () => ({ viewerBlockedWith: vi.fn(async () => state.blocked) }))
vi.mock('@/lib/social/lists', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/lists')>()),
  getPublicListExtras: vi.fn(async () => state.extras),
}))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://kultura.test' }))
vi.mock('@/components/layout/Header', () => ({ Header: stub('Header') }))
vi.mock('@/components/layout/Footer', () => ({ Footer: stub('Footer') }))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: stub('Avatar') }))
vi.mock('@/components/media/MediaGrid', () => ({ MediaGrid: stub('MediaGrid') }))
vi.mock('@/components/collection/OrderedListGrid', () => ({ OrderedListGrid: stub('OrderedListGrid') }))
vi.mock('@/components/collection/PublicCollection', () => ({
  FormatLabel: stub('FormatLabel'),
  SignedInBar: stub('SignedInBar'),
  SignUpCta: stub('SignUpCta'),
}))
vi.mock('@/components/social/ReportButton', () => ({ ReportButton: stub('ReportButton') }))
vi.mock('@/i18n/navigation', () => ({ Link: stub('Link') }))
// «Sala»: la sesión con su perfil, los avisos, la barra de la app y la lista
// (por next/dynamic: dobles que guardan lo que reciben).
vi.mock('@/lib/media/viewer', () => ({
  getViewer: vi.fn(async () => {
    state.calls.push('getViewer')
    return { user: state.user, profile: state.user ? state.profile : null }
  }),
}))
vi.mock('@/lib/social/notifications', () => ({
  getUnreadCount: vi.fn(async () => {
    state.calls.push('getUnreadCount')
    return 3
  }),
}))
vi.mock('@/lib/demo', () => ({ isDemoUser: () => false }))
vi.mock('@/components/layout/AppFooter', () => ({ AppFooter: stub('AppFooter') }))
vi.mock('@/components/layout/AppChromeLazy', () => ({
  AppChromeLazy: ({ children, footer: _footer, ...props }: { children?: ReactNode; footer?: ReactNode } & Record<string, unknown>) => {
    state.chrome = props
    return <div data-sala-stub="chrome">{children}</div>
  },
}))
vi.mock('@/i18n/ClientMessages', () => ({
  ClientMessages: ({ namespaces, children }: { namespaces: readonly string[]; children?: ReactNode }) => (
    <div data-messages={namespaces.length}>{children}</div>
  ),
}))
vi.mock('@/components/sala/SalaLink', () => ({ SalaLink: stub('SalaLink') }))
vi.mock('@/components/lists/sala/SalaPublicListLazy', () => ({
  SalaPublicListLazy: (props: Record<string, unknown>) => {
    state.sala = props
    return <div data-sala-stub="list" />
  },
}))

import PublicListPage, { generateMetadata } from '@/app/[locale]/u/[username]/l/[id]/page'

const OWNER = { id: 'o1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', avatarIcon: null, bio: null }
const ITEMS = [
  { mediaId: 'movie_1', title: 'Dune', poster: '/p1.jpg', type: 'movie', year: 2021 },
  { mediaId: 'movie_2', title: 'Arrival', poster: null, type: 'movie', year: 2016 },
]
const LIST = { owner: OWNER, list: { id: 'l1', name: 'Top', mediaType: 'movie', items: ITEMS } }

const params = Promise.resolve({ locale: 'es', username: 'ana', id: 'l1' })

async function renderPage(): Promise<string> {
  let el = (await PublicListPage({ params })) as ReactElement<Record<string, unknown>>
  // Con «Sala», la página devuelve `SalaPublicListPage`, un componente de
  // servidor asíncrono: se resuelve aquí (`renderToStaticMarkup` no espera).
  if (typeof el.type === 'function' && el.type.constructor.name === 'AsyncFunction') {
    el = (await (el.type as (p: Record<string, unknown>) => Promise<ReactElement>)(el.props)) as ReactElement<Record<string, unknown>>
  }
  return renderToStaticMarkup(el)
}

beforeEach(() => {
  state.user = null
  state.list = LIST
  state.extras = null
  state.blocked = false
  state.profile = null
  state.sala = null
  state.chrome = null
  state.calls = []
  delete process.env.SALA_LISTAS
})
afterEach(() => {
  delete process.env.SALA_LISTAS
})

describe('/u/[username]/l/[id] sin «Sala» (SALA_LISTAS apagada): marcado de hoy', () => {
  it('sin sesión y sin datos extra: rejilla, registro y denuncia pública', async () => {
    expect(await renderPage()).toMatchSnapshot()
  })

  it('con sesión: barra corta y botón de denuncia', async () => {
    state.user = { id: 'v1' }
    expect(await renderPage()).toMatchSnapshot()
  })

  it('un «Ranking personal» con su orden, sus notas y la descripción', async () => {
    state.extras = {
      description: 'Mis favoritas',
      template: 'ranking',
      items: new Map([
        ['movie_1', { position: 1, note: null }],
        ['movie_2', { position: 0, note: 'La mejor' }],
      ]),
    }
    expect(await renderPage()).toMatchSnapshot()
  })

  it('una lista mixta sin plantilla', async () => {
    state.list = { ...LIST, list: { ...LIST.list, mediaType: 'mixed' } }
    state.extras = { description: null, template: null, items: new Map() }
    expect(await renderPage()).toMatchSnapshot()
  })

  it('con SALA_LISTAS=0 tampoco hay «Sala»', async () => {
    process.env.SALA_LISTAS = '0'
    const html = await renderPage()
    expect(html).not.toContain('data-sala')
    delete process.env.SALA_LISTAS
    expect(html).toBe(await renderPage())
  })

  it('con un bloqueo entre quien mira y el dueño: 404', async () => {
    state.user = { id: 'v1' }
    state.blocked = true
    await expect(PublicListPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('metadatos', async () => {
    expect(await generateMetadata({ params })).toMatchSnapshot()
    state.list = null
    expect(await generateMetadata({ params })).toMatchSnapshot()
  })
})

describe('/u/[username]/l/[id] con «Sala» (SALA_LISTAS=1)', () => {
  beforeEach(() => {
    process.env.SALA_LISTAS = '1'
  })

  const RANKING = () => ({
    description: 'Mis favoritas',
    template: 'ranking',
    items: new Map([
      ['movie_1', { position: 1, note: null }],
      ['movie_2', { position: 0, note: 'La mejor' }],
    ]),
  })

  it('sin sesión: cabecera pública, una llamada a registrarse y la denuncia pública', async () => {
    state.extras = RANKING()
    const html = await renderPage()
    expect(html).toContain('data-stub="Header"')
    expect(html).toContain('data-sala-stub="list"')
    expect(html).not.toContain('data-sala-stub="chrome"')
    expect(state.calls).toEqual(['getViewer'])
    expect(state.sala).toMatchObject({
      name: 'Top',
      facts: ['discoverfilters.typebadge.movie', 'lists.template.ranking', 'collection.items{"count":2}'],
      owner: { username: 'ana', label: 'lists.sala.by{"username":"ana"}', href: '/u/ana' },
      description: 'Mis favoritas',
      ranked: true,
      cta: { href: '/login?mode=register&ref=ana', button: 'collection.ctaButton' },
    })
    // El orden del dueño y su nota.
    const entries = state.sala!.entries as Array<Record<string, unknown>>
    expect(entries.map((e) => [e.href, e.note, e.format])).toEqual([
      ['/media/movie/2', 'La mejor', 'movie'],
      ['/media/movie/1', null, 'movie'],
    ])
    const report = state.sala!.report as { props: Record<string, unknown> }
    expect(report.props).toMatchObject({ href: '/report?target=list&id=l1' })
  })

  it('con sesión y perfil: barra de la app, botón de denuncia «Sala» y sin llamada a registrarse', async () => {
    state.user = { id: 'v1' }
    state.profile = { id: 'v1', username: 'bea' }
    const html = await renderPage()
    expect(html).toContain('data-sala-stub="chrome"')
    expect(html).not.toContain('data-stub="Header"')
    expect(html).not.toContain('data-stub="SignedInBar"')
    expect(state.chrome).toMatchObject({ userId: 'v1', unreadCount: 3, demo: false })
    expect(state.sala).toMatchObject({ cta: null, description: null, ranked: false })
    const report = state.sala!.report as { props: Record<string, unknown> }
    expect(report.props).toMatchObject({ targetType: 'list', targetId: 'l1', skin: 'sala', closeLabel: 'common.close' })
    // Una sola lectura de la sesión (con su perfil) para la página y la barra.
    expect(state.calls.filter((c) => c === 'getViewer').length).toBeGreaterThan(0)
    expect(state.calls).toContain('getUnreadCount')
  })

  it('con sesión sin perfil (alta a medias): la barra de hoy', async () => {
    state.user = { id: 'v1' }
    const html = await renderPage()
    expect(html).toContain('data-stub="SignedInBar"')
    expect(html).not.toContain('data-sala-stub="chrome"')
    expect(state.calls).not.toContain('getUnreadCount')
  })

  it('una lista mixta sin datos extra: «varios formatos», sin plantilla', async () => {
    state.list = { ...LIST, list: { ...LIST.list, mediaType: 'mixed' } }
    await renderPage()
    expect(state.sala).toMatchObject({
      facts: ['lists.mediatypemixed', 'collection.items{"count":2}'],
      ranked: false,
    })
  })

  it('con un bloqueo: el mismo 404', async () => {
    state.user = { id: 'v1' }
    state.blocked = true
    await expect(PublicListPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(state.sala).toBeNull()
  })

  it('los mismos metadatos que sin «Sala»', async () => {
    const sala = await generateMetadata({ params })
    delete process.env.SALA_LISTAS
    expect(sala).toEqual(await generateMetadata({ params }))
  })
})
