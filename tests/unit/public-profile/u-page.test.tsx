// ============================================================
// KULTURA — /u/[username] (F-17): escaparate, privacidad e invitación
// La biblioteca (favoritos, contadores, en curso) solo con permiso de quien
// mira (D-04b): sin sesión ni se consulta. La invitación firmada enseña el
// banner y los enlaces de registro llevan la atribución (D-12).
// ============================================================

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
    collection: null as unknown,
    showcase: null as unknown,
    canRead: vi.fn(),
    getShowcase: vi.fn(),
    details: vi.fn(),
    renamed: vi.fn(),
    permanentRedirect: vi.fn((url: string) => {
      throw new Error(`308 ${url}`)
    }),
    notFound: vi.fn(() => {
      throw new Error('NOT_FOUND')
    }),
    marker,
    M: {
      CollectionOwner: marker('CollectionOwner'),
      FavoritesGrid: marker('FavoritesGrid'),
      FormatCounters: marker('FormatCounters'),
      FormatLabel: marker('FormatLabel'),
      InviteBanner: marker('InviteBanner'),
      LockedLibrary: marker('LockedLibrary'),
      PublicListRow: marker('PublicListRow'),
      SignUpCta: marker('SignUpCta'),
      WatchingRow: marker('WatchingRow'),
      ReportButton: marker('ReportButton'),
      InviteLinkButton: marker('InviteLinkButton'),
      Link: marker('Link'),
      KButton: marker('KButton'),
      Header: marker('Header'),
      Footer: marker('Footer'),
    },
  }
})

vi.mock('next/navigation', () => ({ permanentRedirect: h.permanentRedirect, notFound: h.notFound }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/social/public-collection', () => ({
  getPublicCollection: async () => h.collection,
  getLibraryShowcase: (...args: unknown[]) => h.getShowcase(...args),
  getOwnerDetails: (...args: unknown[]) => h.details(...args),
  viewerCanReadLibrary: (...args: unknown[]) => h.canRead(...args),
  resolveRenamedUsername: (...args: unknown[]) => h.renamed(...args),
}))
vi.mock('@/lib/analytics/invite', () => ({
  invitePath: (locale: string, u: { username: string }) => `/${locale}/u/${u.username}?ref=${u.username}&inv=firma`,
  isValidInviteSignature: (_id: string, sig?: string) => sig === 'a'.repeat(20),
}))
vi.mock('@/components/collection/PublicCollection', () => ({
  ...h.M,
  PLURAL_KEY: { movie: 'movies', tv: 'tvs', anime: 'animes', manga: 'mangas', book: 'books', comic: 'comics', game: 'games' },
}))
vi.mock('@/components/collection/InviteLinkButton', () => ({ InviteLinkButton: h.M.InviteLinkButton }))
vi.mock('@/components/social/ReportButton', () => ({ ReportButton: h.M.ReportButton }))
vi.mock('@/components/ui/KButton', () => ({ KButton: h.M.KButton }))
vi.mock('@/components/layout/Header', () => ({ Header: h.M.Header }))
vi.mock('@/components/layout/Footer', () => ({ Footer: h.M.Footer }))
vi.mock('@/i18n/navigation', () => ({ Link: h.M.Link }))

const MARKERS = new Set<unknown>(Object.values(h.M))

type El = ReactElement<Record<string, unknown>>

/** Mini render de servidor: ejecuta los componentes (también async) salvo los marcados. */
async function expand(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(expand))
  if (!isValidElement(node)) return node
  const el = node as El
  if (typeof el.type === 'function' && !MARKERS.has(el.type)) {
    return expand(await (el.type as (p: unknown) => ReactNode | Promise<ReactNode>)(el.props))
  }
  const props: Record<string, unknown> = { ...el.props }
  for (const key of ['children', 'actions']) {
    if (key in props) props[key] = await expand(props[key] as ReactNode)
  }
  return { ...el, props } as ReactNode
}

function all(node: ReactNode, type: unknown, out: Array<Record<string, unknown>> = []) {
  if (Array.isArray(node)) node.forEach((n) => all(n, type, out))
  else if (isValidElement(node)) {
    const el = node as El
    if (el.type === type) out.push(el.props)
    all(el.props.children as ReactNode, type, out)
    if (el.props.actions) all(el.props.actions as ReactNode, type, out)
  }
  return out
}

// Sin sesión la consulta solo trae las columnas públicas (F-02): ni fecha ni visibilidad.
const OWNER = {
  id: 'owner-1', username: 'ana', avatarColor: '#000', avatarInitials: 'AN', avatarIcon: null, bio: null,
  createdAt: null, libraryVisibility: null,
}
const list = (id: string, mediaType = 'movie', n = 1) => ({
  id, name: id, mediaType, items: Array.from({ length: n }, (_, i) => ({ mediaId: `${mediaType}_${id}${i}`, title: 't', poster: 'p', type: mediaType })),
})
const SHOWCASE = {
  total: 3, completed: 1, byFormat: [{ type: 'movie', count: 3 }],
  favorites: [{ mediaId: 'movie_1', title: 'Alien', poster: 'p', type: 'movie', score: 5 }],
  watching: [],
}

async function render(query: Record<string, string> = {}, username = 'ana') {
  const { default: Page } = await import('@/app/[locale]/u/[username]/page')
  return expand(await Page({ params: Promise.resolve({ locale: 'es', username }), searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  h.collection = { owner: { ...OWNER }, lists: [list('l1'), list('l2')] }
  h.canRead.mockResolvedValue(true)
  h.getShowcase.mockResolvedValue(SHOWCASE)
  h.renamed.mockResolvedValue(null)
  h.details.mockResolvedValue({ createdAt: '2026-01-01T00:00:00Z', libraryVisibility: 'friends' })
})

describe('/u sin sesión', () => {
  it('nunca consulta la biblioteca ni las columnas privadas del dueño, y explica que hace falta cuenta', async () => {
    const tree = await render()
    expect(h.canRead).not.toHaveBeenCalled()
    expect(h.getShowcase).not.toHaveBeenCalled()
    expect(h.details).not.toHaveBeenCalled()
    expect(all(tree, h.M.FavoritesGrid)).toHaveLength(0)
    expect(all(tree, h.M.FormatCounters)).toHaveLength(0)
    const locked = all(tree, h.M.LockedLibrary)
    expect(locked).toHaveLength(1)
    expect(String(locked[0].title)).toContain('lockedTitle')
    expect(locked[0].text).toBe('lockedText')
  })

  it('invitación firmada: banner "te invita" con amistad y el registro lleva ref + inv', async () => {
    const inv = 'a'.repeat(20)
    const tree = await render({ ref: 'ana', inv, utm_source: 'Reddit' })
    const [banner] = all(tree, h.M.InviteBanner)
    expect(banner.friendsOnSignup).toBe(true)
    expect(banner.registerHref).toBe(`/login?mode=register&utm_source=reddit&ref=ana&inv=${inv}`)
    expect(all(tree, h.M.SignUpCta)[0].href).toBe(banner.registerHref)
  })

  it('firma que no cuadra: banner sin prometer amistad (y la firma no viaja si no tiene formato)', async () => {
    const tree = await render({ ref: 'ana', inv: 'b'.repeat(20) })
    const [banner] = all(tree, h.M.InviteBanner)
    expect(banner.friendsOnSignup).toBe(false)
    const bad = all(await render({ ref: 'ana', inv: 'nope' }), h.M.InviteBanner)[0]
    expect(bad.registerHref).toBe('/login?mode=register&ref=ana')
  })

  it('sin ref: no hay banner y el alta se atribuye a este perfil (sin firma)', async () => {
    const tree = await render({ utm_source: 'tiktok' })
    expect(all(tree, h.M.InviteBanner)).toHaveLength(0)
    expect(all(tree, h.M.SignUpCta)[0].href).toBe('/login?mode=register&utm_source=tiktok&ref=ana')
  })

  it('denunciar sin cuenta lleva al formulario público (F-11)', async () => {
    const tree = await render()
    expect(all(tree, h.M.ReportButton)).toHaveLength(0)
    expect(all(tree, h.M.Link).map((l) => l.href)).toContain('/report?target=user&id=ana')
  })

  it('REN-6: sin biblioteca visible, la primera lista carga sus portadas con prioridad', async () => {
    const rows = all(await render(), h.M.PublicListRow)
    expect(rows.map((r) => r.priorityCount)).toEqual([4, 0])
  })
})

describe('/u con sesión', () => {
  beforeEach(() => {
    h.user = { id: 'visitor' }
  })

  it('con permiso: contadores, favoritos (con prioridad) y denuncia con el botón de F-11', async () => {
    const tree = await render()
    expect(h.canRead).toHaveBeenCalledWith(expect.anything(), 'owner-1')
    expect(all(tree, h.M.FormatCounters)[0].showcase).toEqual(SHOWCASE)
    const [grid] = all(tree, h.M.FavoritesGrid)
    expect(grid).toMatchObject({ isOwner: false, priority: true })
    expect(all(tree, h.M.LockedLibrary)).toHaveLength(0)
    expect(all(tree, h.M.PublicListRow).map((r) => r.priorityCount)).toEqual([0, 0])
    expect(all(tree, h.M.ReportButton)[0]).toMatchObject({ targetType: 'user', targetId: 'owner-1' })
    expect(all(tree, h.M.SignUpCta)).toHaveLength(0)
    expect(all(tree, h.M.InviteBanner)).toHaveLength(0)
  })

  it("con 'private': solo dice que es privada, sin botones", async () => {
    h.canRead.mockResolvedValue(false)
    h.details.mockResolvedValue({ createdAt: null, libraryVisibility: 'private' })
    const [locked] = all(await render(), h.M.LockedLibrary)
    expect(locked.text).toBe('libraryHiddenPrivate')
    expect(locked.children).toBeUndefined()
  })

  it('la fecha de alta y la visibilidad se leen con la sesión y llegan a la cabecera', async () => {
    const tree = await render()
    expect(h.details).toHaveBeenCalledWith(expect.anything(), 'owner-1')
    expect(all(tree, h.M.CollectionOwner)[0].owner).toMatchObject({ createdAt: '2026-01-01T00:00:00Z', libraryVisibility: 'friends' })
  })

  it('sin permiso (solo amigos): no se pinta nada de la biblioteca aunque la lectura devolviera filas', async () => {
    h.canRead.mockResolvedValue(false)
    const tree = await render({ ref: 'ana' })
    expect(all(tree, h.M.FormatCounters)).toHaveLength(0)
    expect(all(tree, h.M.FavoritesGrid)).toHaveLength(0)
    const [locked] = all(tree, h.M.LockedLibrary)
    expect(locked.text).toBe('libraryHiddenFriends')
    expect(all(tree, h.M.InviteBanner)).toHaveLength(0)
  })

  it('el dueño: botón de invitar con su enlace firmado, aviso de visibilidad y huecos de favoritos', async () => {
    h.user = { id: 'owner-1' }
    const tree = await render()
    expect(h.canRead).not.toHaveBeenCalled()
    expect(all(tree, h.M.InviteLinkButton)[0].path).toBe('/es/u/ana?ref=ana&inv=firma')
    expect(all(tree, h.M.FavoritesGrid)[0].isOwner).toBe(true)
    expect(all(tree, h.M.Link).map((l) => l.href)).toContain('/settings')
    expect(all(tree, h.M.ReportButton)).toHaveLength(0)
  })
})

describe('/u: nombres antiguos y metadatos', () => {
  it('un nombre antiguo redirige (308) conservando la invitación', async () => {
    h.collection = null
    h.renamed.mockResolvedValue('ana_nueva')
    await expect(render({ ref: 'ana_vieja', inv: 'a'.repeat(20) }, 'ana_vieja')).rejects.toThrow(
      `308 /es/u/ana_nueva?ref=ana_vieja&inv=${'a'.repeat(20)}`,
    )
  })

  it('canonical sin ?ref y fuera del índice con menos de 5 títulos públicos', async () => {
    const { generateMetadata } = await import('@/app/[locale]/u/[username]/page')
    const thin = await generateMetadata({ params: Promise.resolve({ locale: 'es', username: 'ana' }) })
    expect(thin.alternates?.canonical).toBe('/es/u/ana')
    expect(thin.robots).toEqual({ index: false, follow: true })
    h.collection = { owner: { ...OWNER }, lists: [list('l1', 'movie', 3), list('l2', 'game', 2)] }
    const rich = await generateMetadata({ params: Promise.resolve({ locale: 'en', username: 'ana' }) })
    expect(rich.robots).toBeUndefined()
    expect(rich.alternates?.canonical).toBe('/en/u/ana')
  })
})
