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
  SalaProfilePrimaryButtonLazy: stub('primary-button'),
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
