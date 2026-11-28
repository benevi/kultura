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

import PublicListPage, { generateMetadata } from '@/app/[locale]/u/[username]/l/[id]/page'

const OWNER = { id: 'o1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', avatarIcon: null, bio: null }
const ITEMS = [
  { mediaId: 'movie_1', title: 'Dune', poster: '/p1.jpg', type: 'movie', year: 2021 },
  { mediaId: 'movie_2', title: 'Arrival', poster: null, type: 'movie', year: 2016 },
]
const LIST = { owner: OWNER, list: { id: 'l1', name: 'Top', mediaType: 'movie', items: ITEMS } }

const params = Promise.resolve({ locale: 'es', username: 'ana', id: 'l1' })

async function renderPage(): Promise<string> {
  return renderToStaticMarkup((await PublicListPage({ params })) as ReactElement)
}

beforeEach(() => {
  state.user = null
  state.list = LIST
  state.extras = null
  state.blocked = false
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
