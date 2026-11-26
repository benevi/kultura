// ============================================================
// KULTURA — Perfil: HTML de la página (caracterización, fase 8.5 P1).
//
// Fija lo que pinta hoy `/profile/[username]` en el servidor (cabecera,
// acciones según quién mira, actividad del amigo, filas, estados de
// biblioteca oculta y vacía, estadísticas y géneros, con su orden y lo que
// recibe cada pieza) para que la bandera `SALA_PERFIL` apagada lo deje
// EXACTAMENTE igual. La instantánea se sacó antes de tocar el perfil: si
// cambia, algo de «Sala» se ha colado. Las piezas son dobles que escriben sus
// props.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

type Scenario = {
  viewer: string | null
  owner: { id: string; username: string; library_visibility: string }
  canRead: boolean
  friendship: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
  empty: boolean
  publicLists: boolean
}

const { state } = vi.hoisted(() => ({
  state: {
    s: null as unknown as Scenario,
    sala: null as Record<string, unknown> | null,
    usersSelect: null as string | null,
  },
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
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

/** Doble de una pieza: un `div` con su nombre y sus props. */
function stub(name: string) {
  return function Stub(props: Record<string, unknown>) {
    return <div data-stub={name} data-props={JSON.stringify(props)} />
  }
}
vi.mock('@/components/profile/ProfileHeader', () => ({ ProfileHeader: stub('ProfileHeader') }))
vi.mock('@/components/profile/ProfileStats', () => ({ ProfileStats: stub('ProfileStats') }))
vi.mock('@/components/profile/ProfileGenres', () => ({ ProfileGenres: stub('ProfileGenres') }))
vi.mock('@/components/social/FriendshipButton', () => ({ FriendshipButton: stub('FriendshipButton') }))
vi.mock('@/components/social/ReportButton', () => ({ ReportButton: stub('ReportButton') }))
vi.mock('@/components/social/ShareLinkButton', () => ({ ShareLinkButton: stub('ShareLinkButton') }))
vi.mock('@/components/push/PushOffer', () => ({ PushOffer: stub('PushOffer') }))
vi.mock('@/components/home/MediaRow', () => ({ MediaRow: stub('MediaRow') }))
vi.mock('@/app/[locale]/(app)/home/sections', () => ({
  FriendProfileActivity: stub('FriendProfileActivity'),
  FriendsActivitySkeleton: stub('FriendsActivitySkeleton'),
}))
// Con «Sala» las piezas llegan por next/dynamic: aquí, dobles que guardan lo que reciben.
vi.mock('@/components/profile/sala/SalaProfileLazy', () => {
  const lazy = (name: string) =>
    function SalaStub(props: Record<string, unknown>) {
      state.sala = { ...(state.sala ?? {}), [name]: props }
      return <div data-sala-stub={name}>{props.children as React.ReactNode}</div>
    }
  return {
    SalaProfileHeaderLazy: lazy('header'),
    SalaProfileNumbersLazy: lazy('numbers'),
    SalaProfileRowLazy: lazy('row'),
    SalaProfileStateLazy: lazy('state'),
    SalaProfileEditLazy: lazy('edit'),
  }
})

const STATS = {
  totalItems: 3,
  totalCompleted: 1,
  totalInProgress: 1,
  byType: [{ type: 'movie', total: 2, completed: 1 }, { type: 'manga', total: 1, completed: 0 }],
  topGenres: [{ genre: 'Drama', count: 2 }],
}
const ENTRY = (mediaId: string, title: string, poster: string | null) => ({ mediaId, title, poster })

vi.mock('@/lib/library/stats', () => ({
  getUserStats: vi.fn(async () => (state.s.empty ? { totalItems: 0, totalCompleted: 0, totalInProgress: 0, byType: [], topGenres: [] } : STATS)),
}))
vi.mock('@/lib/library/queries', () => ({
  getRecentLibraryByStatus: vi.fn(async (_id: string, status: string) => {
    if (state.s.empty) return []
    if (status === 'completed') return [ENTRY('movie_1', 'Peli', 'https://x/p.jpg')]
    if (status === 'in_progress') return [ENTRY('manga_2', 'Manga', null)]
    return [ENTRY('game_3', 'Juego', null)]
  }),
}))
vi.mock('@/lib/social/friends', () => ({ getFriendshipStatus: vi.fn(async () => state.s.friendship) }))
vi.mock('@/lib/social/public-collection', () => ({ hasPublicLists: vi.fn(async () => state.s.publicLists) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.s.viewer ? { id: state.s.viewer } : null } }) },
    rpc: async () => ({ data: state.s.canRead, error: null }),
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === 'users') state.usersSelect = cols
        const row =
          table === 'users'
            ? {
                ...state.s.owner,
                avatar_color: 'orange',
                avatar_initials: 'BE',
                avatar_icon: null,
                created_at: '2026-10-01T10:00:00.000Z',
                bio: 'Mi bio',
              }
            : { id: 'friendship-1' }
        const chain: Record<string, unknown> = {}
        chain.eq = () => chain
        chain.or = () => chain
        chain.maybeSingle = async () => ({ data: row })
        return chain
      },
    }),
  }),
}))

const OWNER = { id: 'owner-1', username: 'benevi', library_visibility: 'public' }

async function renderProfile(): Promise<string> {
  const { default: ProfilePage } = await import('@/app/[locale]/(app)/profile/[username]/page')
  const page = await ProfilePage({ params: Promise.resolve({ locale: 'es', username: 'benevi' }) })
  return renderToStaticMarkup(page as ReactElement)
}

const SCENARIOS: Record<string, Scenario> = {
  propio: { viewer: 'owner-1', owner: OWNER, canRead: true, friendship: 'none', empty: false, publicLists: true },
  amiga: { viewer: 'viewer-1', owner: OWNER, canRead: true, friendship: 'accepted', empty: false, publicLists: false },
  oculta: { viewer: 'viewer-1', owner: { ...OWNER, library_visibility: 'friends' }, canRead: false, friendship: 'none', empty: false, publicLists: false },
  vacio: { viewer: 'owner-1', owner: OWNER, canRead: true, friendship: 'none', empty: true, publicLists: false },
}

beforeEach(() => {
  state.sala = null
  state.usersSelect = null
  delete process.env.SALA_PERFIL
})
afterEach(() => {
  delete process.env.SALA_PERFIL
})

describe('Perfil sin «Sala» (SALA_PERFIL apagada): marcado de hoy', () => {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    it(name, async () => {
      state.s = scenario
      expect(await renderProfile()).toMatchSnapshot()
      expect(state.sala).toBeNull()
    })
  }

  it('con SALA_PERFIL=0 tampoco hay «Sala»', async () => {
    process.env.SALA_PERFIL = '0'
    state.s = SCENARIOS.amiga
    const html = await renderProfile()
    expect(html).not.toContain('data-sala')
    expect(state.sala).toBeNull()
  })
})
