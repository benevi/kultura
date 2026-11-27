// ============================================================
// KULTURA — /u/[username]/r/[type]/[id]: HTML de la página (caracterización,
// fase 8.5 P4).
//
// Fija lo que pinta hoy la nota pública en el servidor (barra, póster,
// persona, encabezado con la nota o el genérico, botones, aviso del dueño y
// llamada a registrarse) para que la bandera `SALA_PERFIL` apagada lo deje
// EXACTAMENTE igual. La instantánea se sacó antes de tocar la página: si
// cambia, algo de «Sala» se ha colado. Las piezas son dobles que escriben sus
// props; lo que decide qué se ve (`resolveRatingShare`) es un doble con cada
// salida posible.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

type View =
  | { kind: 'generic' }
  | { kind: 'rated'; text: string; rating10: number; scale: 'ten' | 'stars' | 'legacy'; isOwner: boolean; signed: boolean }

type Scenario = { viewer: string | null; view: View; query?: Record<string, string> }

const h = vi.hoisted(() => ({
  s: null as unknown as Scenario,
  calls: [] as string[],
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (arg?: unknown) => {
    const ns = typeof arg === 'string' ? arg : (arg as { namespace?: string } | undefined)?.namespace ?? 'x'
    const t = (k: string, v?: Record<string, unknown>) => `${ns}.${k}${v ? `(${Object.values(v).join(',')})` : ''}`
    t.raw = (k: string) =>
      k === 'page.heading'
        ? '<who>@{username}</who> le da <score>{rating}</score> a <work>{title}</work>'
        : '<work>{title}</work> en KULTURA'
    return t
  }),
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
  SignUpCta: stub('SignUpCta'),
  SignedInBar: stub('SignedInBar'),
}))
vi.mock('@/components/ui/KButton', () => ({ KButton: stub('KButton') }))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: stub('Avatar') }))
vi.mock('@/components/media/PosterFrame', () => ({ PosterFrame: stub('PosterFrame') }))
vi.mock('@/components/layout/Header', () => ({ Header: stub('Header') }))
vi.mock('@/components/layout/Footer', () => ({ Footer: stub('Footer') }))
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://kultura.test' }))

const OWNER = { id: 'owner-1', username: 'benevi', avatarColor: 'orange', avatarInitials: 'BE', libraryVisibility: 'friends' }
const PARSED = { id: 'movie_438631', type: 'movie', externalId: '438631' }
const MEDIA = { title: 'Dune', poster: 'https://x/dune.jpg', year: 2021 }

vi.mock('@/lib/share/rating-share', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/share/rating-share')>()
  return {
    ...real,
    resolveRatingShare: vi.fn(async () => {
      h.calls.push('resolveRatingShare')
      const v = h.s.view
      if (v.kind === 'generic') return { kind: 'generic', owner: OWNER, parsed: PARSED, media: MEDIA }
      return {
        kind: 'rated',
        owner: OWNER,
        parsed: PARSED,
        media: MEDIA,
        rating: { rating10: v.rating10, scale: v.scale, text: v.text },
        signed: v.signed,
        isOwner: v.isOwner,
      }
    }),
  }
})
// «Sala» (P4): la sesión con su perfil y los avisos.
vi.mock('@/lib/media/viewer', () => ({
  getViewer: vi.fn(async () => {
    h.calls.push('getViewer')
    return h.s.viewer
      ? { user: { id: h.s.viewer, user_metadata: {} }, profile: { username: 'yo', avatar_color: 'pink', avatar_initials: 'YO' } }
      : { user: null, profile: null }
  }),
}))
vi.mock('@/lib/social/notifications', () => ({ getUnreadCount: vi.fn(async () => 3) }))
vi.mock('@/components/layout/AppChromeLazy', () => ({ AppChromeLazy: stub('AppChrome') }))
vi.mock('@/components/layout/AppFooter', () => ({ AppFooter: stub('AppFooter') }))
vi.mock('@/i18n/ClientMessages', () => ({ ClientMessages: stub('ClientMessages') }))
vi.mock('@/components/profile/sala/SalaProfilePublicLazy', () => ({
  SalaProfileReviewLazy: stub('review'),
  SalaProfileCtaLazy: stub('cta'),
  SalaProfileLinkButtonLazy: stub('link-button'),
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
  const { default: Page } = await import('@/app/[locale]/u/[username]/r/[type]/[id]/page')
  const page = await Page({
    params: Promise.resolve({ locale: 'es', username: 'benevi', type: 'movie', id: '438631' }),
    searchParams: Promise.resolve(h.s.query ?? {}),
  })
  return renderToStaticMarkup((await expand(page)) as ReactElement)
}

const RATED_TEN: View = { kind: 'rated', text: '9/10', rating10: 9, scale: 'ten', isOwner: false, signed: false }
const SCENARIOS: Record<string, Scenario> = {
  'anonimo-generico': { viewer: null, view: { kind: 'generic' } },
  'anonimo-firmado': { viewer: null, view: { ...RATED_TEN, signed: true }, query: { s: 'firma', utm_source: 'reddit' } },
  'anonimo-con-ref': { viewer: null, view: { kind: 'generic' }, query: { ref: 'otra', utm_source: 'x' } },
  'con-sesion': { viewer: 'viewer-1', view: { kind: 'rated', text: '4,5★', rating10: 9, scale: 'stars', isOwner: false, signed: false } },
  'con-sesion-generico': { viewer: 'viewer-1', view: { kind: 'generic' } },
  propio: { viewer: 'owner-1', view: { kind: 'rated', text: '4★', rating10: 8, scale: 'legacy', isOwner: true, signed: false } },
}

beforeEach(() => {
  h.calls = []
  delete process.env.SALA_PERFIL
})
afterEach(() => {
  delete process.env.SALA_PERFIL
})

describe('/r sin «Sala» (SALA_PERFIL apagada): marcado de hoy', () => {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    it(name, async () => {
      h.s = scenario
      const html = await renderPage()
      expect(html).toMatchSnapshot()
      expect(html).not.toContain('data-sala')
    })
  }

  it('con SALA_PERFIL=0 tampoco hay «Sala» ni se pide la sesión con su perfil', async () => {
    process.env.SALA_PERFIL = '0'
    h.s = SCENARIOS['con-sesion']
    expect(await renderPage()).not.toContain('data-sala')
    expect(h.calls).not.toContain('getViewer')
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

describe('/r con «Sala» (SALA_PERFIL=1)', () => {
  beforeEach(() => {
    process.env.SALA_PERFIL = '1'
  })

  it('anónimo sin firma: la genérica, sin nota; «Ver la ficha», el perfil y una sola llamada a registrarse al final', async () => {
    h.s = SCENARIOS['anonimo-generico']
    const html = await renderPage()
    expect(html).toContain('data-sala-profile="rating"')
    expect(names(html)).toEqual(['Header', 'review', 'link-button', 'link-button', 'cta', 'Footer'])
    const [review] = props(html, 'review')
    expect(review).toMatchObject({
      username: 'benevi',
      profileHref: '/u/benevi',
      lead: null,
      title: 'Dune',
      format: 'movie',
      formatLabel: 'media.movie',
      year: 2021,
      score: null,
      text: 'share.page.genericLead(benevi,Dune)',
      hint: null,
    })
    expect(props(html, 'link-button')).toEqual([
      { variant: 'primary', href: '/media/movie/438631' },
      { href: '/u/benevi' },
    ])
    expect(html).toContain('share.page.viewTitle')
    expect(props(html, 'cta')[0]).toMatchObject({ href: expect.stringContaining('mode=register') })
    expect(html.match(/mode=register/g)).toHaveLength(1)
    // Sin sesión no se pide nada más que la vista de hoy (ni avisos ni barra).
    expect(h.calls.filter((c) => c !== 'getViewer' && c !== 'resolveRatingShare')).toEqual([])
  })

  it('anónimo con el enlace firmado: la nota en la escala de su dueño y el alta atribuida a quien compartió', async () => {
    h.s = SCENARIOS['anonimo-firmado']
    const html = await renderPage()
    const [review] = props(html, 'review')
    expect(review).toMatchObject({
      lead: 'share.page.salaLead(benevi)',
      score: { label: 'share.page.salaScoreLabel', value: '9', of: 'share.page.salaScoreOf(ten)' },
      text: null,
      hint: null,
    })
    expect(props(html, 'cta')[0].href).toBe('/login?mode=register&next=%2Fes%2Fmedia%2Fmovie%2F438631&utm_source=reddit&ref=benevi')
  })

  it('con sesión: la barra de la app (con los textos del shell), «Puntúalo tú», sin llamada a registrarse; nota «4,5 de 5»', async () => {
    h.s = SCENARIOS['con-sesion']
    const html = await renderPage()
    const order = names(html)
    expect(order.slice(0, 3)).toEqual(['ClientMessages', 'AppChrome', 'ClientMessages'])
    expect(order).not.toContain('Header')
    expect(order).not.toContain('cta')
    expect(props(html, 'AppChrome')[0]).toMatchObject({ userId: 'viewer-1', unreadCount: 3, demo: false })
    expect(props(html, 'review')[0]).toMatchObject({ score: { value: '4,5', of: 'share.page.salaScoreOf(stars)' } })
    expect(html).toContain('share.page.ctaRate')
    expect(html).not.toContain('mode=register')
  })

  it('con sesión y sin nota visible: la genérica, sin pedir nada más', async () => {
    h.s = SCENARIOS['con-sesion-generico']
    const html = await renderPage()
    expect(props(html, 'review')[0]).toMatchObject({ score: null, lead: null })
    expect(html).not.toContain('mode=register')
  })

  it('propio con escala antigua: «4 de 5» y la pista de quién la ve', async () => {
    h.s = SCENARIOS.propio
    const html = await renderPage()
    expect(props(html, 'review')[0]).toMatchObject({
      score: { value: '4', of: 'share.page.salaScoreOf(stars)' },
      hint: 'share.page.ownerHint',
    })
  })
})
