// ============================================================
// KULTURA — Páginas de F-12 en el servidor: /welcome, perfil y /u
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  tables: {} as Record<string, unknown>,
  rpc: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`308 ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  stats: vi.fn(),
  recent: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: h.redirect,
  permanentRedirect: h.permanentRedirect,
  notFound: h.notFound,
}))
vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('next-intl/server', () => ({
  getMessages: async () => ({ onboarding: {}, auth: {}, aiRecommendations: {}, landing: {} }),
  getTranslations: async () => (k: string) => k,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => h.tables[table],
    rpc: h.rpc,
  }),
}))
vi.mock('@/lib/library/stats', () => ({ getUserStats: h.stats }))
vi.mock('@/lib/library/queries', () => ({ getRecentLibraryByStatus: h.recent }))
vi.mock('@/lib/social/friends', () => ({ getFriendshipStatus: async () => 'none' }))
vi.mock('@/i18n/navigation', () => ({ Link: () => null }))
vi.mock('@/app/[locale]/welcome/WelcomeFlow', () => ({ WelcomeFlow: () => null }))

function single(data: unknown, error: unknown = null) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'order']) c[m] = () => c
  c.maybeSingle = async () => ({ data, error })
  c.single = async () => ({ data, error })
  return c
}

/** Props del primer elemento cuyo tipo sea `type` (busca en profundidad). */
function findProps(node: ReactNode, type: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProps(child, type)
      if (found) return found
    }
    return null
  }
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === type) return el.props as Record<string, unknown>
  return findProps(el.props?.children, type)
}

function texts(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(texts).join(' ')
  const el = node as ReactElement<{ children?: ReactNode }>
  return texts(el.props?.children)
}

const NEW_USER = { id: 'u1', created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} }

describe('/welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.user = NEW_USER
    h.tables = {
      users: single({ username: 'u_3f9a1c' }),
      account_state: single({ onboarded_at: null, terms_accepted_at: null }),
    }
  })

  async function page(next?: string) {
    const { default: WelcomePage } = await import('@/app/[locale]/welcome/page')
    return WelcomePage({ params: Promise.resolve({ locale: 'es' }), searchParams: Promise.resolve(next ? { next } : {}) })
  }

  it('sin sesión → login con vuelta al onboarding', async () => {
    h.user = null
    await expect(page('/es/u/benevi')).rejects.toThrow(
      `REDIRECT /es/login?next=${encodeURIComponent(`/es/welcome?next=${encodeURIComponent('/es/u/benevi')}`)}`
    )
  })

  it('la demo no hace onboarding', async () => {
    h.user = { ...NEW_USER, app_metadata: { demo: true } }
    await expect(page()).rejects.toThrow('REDIRECT /es/home')
  })

  it('quien ya lo hizo va directo a su destino', async () => {
    h.tables.account_state = single({ onboarded_at: '2026-10-01T00:00:00Z' })
    await expect(page('/es/library')).rejects.toThrow('REDIRECT /es/library')
  })

  it('un `next` externo se sanea', async () => {
    h.tables.account_state = single({ onboarded_at: '2026-10-01T00:00:00Z' })
    await expect(page('https://evil.com')).rejects.toThrow('REDIRECT /es/home')
  })

  it('alta con Google (sin términos): pide la casilla y ofrece cambiar el nombre generado', async () => {
    const { WelcomeFlow } = await import('@/app/[locale]/welcome/WelcomeFlow')
    const props = findProps(await page(), WelcomeFlow)
    expect(props).toMatchObject({
      locale: 'es',
      next: '/es/home',
      currentUsername: 'u_3f9a1c',
      suggestChange: true,
      needsTerms: true,
    })
  })

  it('alta por email (términos en el alta): no vuelve a pedirlos', async () => {
    h.tables.account_state = single({ onboarded_at: null, terms_accepted_at: '2026-10-22T10:00:00Z' })
    const { WelcomeFlow } = await import('@/app/[locale]/welcome/WelcomeFlow')
    expect(findProps(await page(), WelcomeFlow)).toMatchObject({ needsTerms: false })
  })
})

describe('/profile/[username] (D-04b y nombres antiguos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.user = { id: 'visitor' }
    h.stats.mockResolvedValue({ totalItems: 4, totalCompleted: 2, totalInProgress: 1, byType: [], topGenres: [] })
    h.recent.mockResolvedValue([])
    h.tables = {
      users: single({ id: 'owner', username: 'ana', avatar_color: 'blue', avatar_initials: 'AN', library_visibility: 'friends', created_at: '2026-01-01' }),
      lists: single(null),
    }
  })

  async function page(username: string) {
    const { default: ProfilePage } = await import('@/app/[locale]/(app)/profile/[username]/page')
    return ProfilePage({ params: Promise.resolve({ locale: 'es', username }) })
  }

  it('nombre antiguo → 308 al actual', async () => {
    h.tables.users = single(null)
    h.rpc.mockResolvedValue({ data: 'ana_nueva', error: null })
    await expect(page('ana_vieja')).rejects.toThrow('308 /es/profile/ana_nueva')
    expect(h.rpc).toHaveBeenCalledWith('username_redirect', { p_username: 'ana_vieja' })
  })

  it('nombre que no existe ni existió → 404', async () => {
    h.tables.users = single(null)
    h.rpc.mockResolvedValue({ data: null, error: null })
    await expect(page('nadie')).rejects.toThrow('NOT_FOUND')
  })

  it('biblioteca solo para amigos y el visitante no lo es → aviso, sin consultar la biblioteca', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null })
    const tree = await page('ana')
    expect(h.rpc).toHaveBeenCalledWith('can_read_library', { p_owner: 'owner' })
    expect(h.stats).not.toHaveBeenCalled()
    expect(h.recent).not.toHaveBeenCalled()
    const text = texts(tree)
    expect(text).toContain('libraryHidden')
    expect(text).toContain('libraryHiddenFriends')
    expect(text).not.toContain('emptyOther')
  })

  it('con permiso se ve como siempre', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null })
    const tree = await page('ana')
    expect(h.stats).toHaveBeenCalledWith('owner')
    expect(texts(tree)).not.toContain('libraryHidden')
  })

  it('sin la migración (función inexistente) rige W1: se ve', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    await page('ana')
    expect(h.stats).toHaveBeenCalled()
  })
})

describe('/u/[username] (pública)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.user = null
  })

  it('nombre antiguo → 308 al actual, así los enlaces compartidos no se rompen', async () => {
    h.tables = { users: single(null) }
    h.rpc.mockResolvedValue({ data: 'ana_nueva', error: null })
    const { default: PublicCollectionPage } = await import('@/app/[locale]/u/[username]/page')
    await expect(
      PublicCollectionPage({ params: Promise.resolve({ locale: 'en', username: 'ana_vieja' }) })
    ).rejects.toThrow('308 /en/u/ana_nueva')
  })

  it('sin la función (migración sin aplicar) → 404 de siempre', async () => {
    h.tables = { users: single(null) }
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    const { default: PublicCollectionPage } = await import('@/app/[locale]/u/[username]/page')
    await expect(
      PublicCollectionPage({ params: Promise.resolve({ locale: 'es', username: 'x_y' }) })
    ).rejects.toThrow('NOT_FOUND')
  })
})
