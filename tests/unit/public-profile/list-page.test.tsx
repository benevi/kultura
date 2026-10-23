// F-17: lista pública /u/[username]/l/[id] — 308 desde un nombre antiguo
// (pendiente de F-12) y denuncia (D-13): botón con sesión, formulario sin ella.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

const h = vi.hoisted(() => {
  const marker = (name: string) => {
    const fn = (props: Record<string, unknown>) => ({ marker: name, props })
    Object.defineProperty(fn, 'name', { value: name })
    return fn
  }
  return {
    user: null as { id: string } | null,
    list: null as unknown,
    exists: vi.fn(),
    renamed: vi.fn(),
    v2: true,
    permanentRedirect: vi.fn((url: string) => {
      throw new Error(`308 ${url}`)
    }),
    notFound: vi.fn(() => {
      throw new Error('NOT_FOUND')
    }),
    M: {
      ReportButton: marker('ReportButton'),
      Link: marker('Link'),
      SignUpCta: marker('SignUpCta'),
      FormatLabel: marker('FormatLabel'),
      MediaGrid: marker('MediaGrid'),
      Avatar: marker('Avatar'),
      Header: marker('Header'),
      Footer: marker('Footer'),
    },
  }
})

vi.mock('next/navigation', () => ({ permanentRedirect: h.permanentRedirect, notFound: h.notFound }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/social/public-collection', () => ({
  getPublicList: async () => h.list,
  usernameExists: (...a: unknown[]) => h.exists(...a),
  resolveRenamedUsername: (...a: unknown[]) => h.renamed(...a),
}))
vi.mock('@/lib/social/friends', () => ({ isModerationV2: () => h.v2 }))
vi.mock('@/components/social/ReportButton', () => ({ ReportButton: h.M.ReportButton }))
vi.mock('@/components/collection/PublicCollection', () => ({ SignUpCta: h.M.SignUpCta, FormatLabel: h.M.FormatLabel }))
vi.mock('@/components/media/MediaGrid', () => ({ MediaGrid: h.M.MediaGrid }))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: h.M.Avatar }))
vi.mock('@/components/layout/Header', () => ({ Header: h.M.Header }))
vi.mock('@/components/layout/Footer', () => ({ Footer: h.M.Footer }))
vi.mock('@/i18n/navigation', () => ({ Link: h.M.Link }))

function all(node: ReactNode, type: unknown, out: Array<Record<string, unknown>> = []) {
  if (Array.isArray(node)) node.forEach((n) => all(n, type, out))
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>
    if (el.type === type) out.push(el.props)
    all(el.props.children as ReactNode, type, out)
  }
  return out
}

const LIST = {
  owner: { id: 'o1', username: 'ana', avatarColor: '#000', avatarInitials: 'AN', avatarIcon: null, bio: null },
  list: { id: '11111111-1111-1111-1111-111111111111', name: 'Top', mediaType: 'movie', items: [] },
}

async function page(username = 'ana') {
  const { default: Page } = await import('@/app/[locale]/u/[username]/l/[id]/page')
  return Page({ params: Promise.resolve({ locale: 'es', username, id: LIST.list.id }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  h.list = LIST
  h.v2 = true
  h.exists.mockResolvedValue(true)
  h.renamed.mockResolvedValue(null)
})

describe('/u/[username]/l/[id]', () => {
  it('nombre antiguo → 308 a la misma lista con el nombre actual', async () => {
    h.list = null
    h.exists.mockResolvedValue(false)
    h.renamed.mockResolvedValue('ana_nueva')
    await expect(page('ana_vieja')).rejects.toThrow(`308 /es/u/ana_nueva/l/${LIST.list.id}`)
  })

  it('lista privada de alguien que existe → 404 (no se busca un nombre antiguo)', async () => {
    h.list = null
    await expect(page()).rejects.toThrow('NOT_FOUND')
    expect(h.renamed).not.toHaveBeenCalled()
  })

  it('sin sesión: enlace al formulario público y registro atribuido a la lista', async () => {
    const tree = await page()
    expect(all(tree, h.M.ReportButton)).toHaveLength(0)
    expect(all(tree, h.M.Link).map((l) => l.href)).toContain(`/report?target=list&id=${LIST.list.id}`)
    expect(all(tree, h.M.SignUpCta)[0].href).toBe('/login?mode=register&ref=ana')
  })

  it('con sesión: ReportButton de lista (con MODERATION_V2) y sin llamada a registrarse', async () => {
    h.user = { id: 'v' }
    const tree = await page()
    expect(all(tree, h.M.ReportButton)[0]).toMatchObject({ targetType: 'list', targetId: LIST.list.id })
    expect(all(tree, h.M.SignUpCta)).toHaveLength(0)
    h.v2 = false
    expect(all(await page(), h.M.ReportButton)).toHaveLength(0)
  })
})
