// ============================================================
// KULTURA — /lists: HTML del índice (caracterización, fase 8.5 L1).
//
// Fija lo que pinta hoy «Mis listas» (cabecera con «Nueva lista», tarjetas
// con su degradado, número de títulos, colaborativa, formato, plantilla y
// dueño, el vacío y el esqueleto de `loading.tsx`) para que la bandera
// `SALA_LISTAS` apagada lo deje EXACTAMENTE igual. La instantánea se sacó
// antes de tocar el índice: si cambia, algo de «Sala» se ha colado.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { List } from '@/types/list'

const { state, getUserLists } = vi.hoisted(() => ({
  state: { lists: [] as List[], userId: 'u1' as string | null, sala: null as Record<string, unknown> | null },
  getUserLists: { calls: [] as unknown[][] },
}))

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`
    t.has = () => true
    t.rich = t
    return t
  }
  return { useTranslations: make, useLocale: () => 'es' }
})
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (ns?: string) => (k: string) => `${ns}.${k}`),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT') }) }))
vi.mock('@/components/social/CreateListModal', () => ({
  CreateListModal: () => <div data-stub="CreateListModal" />,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) },
  })),
}))
vi.mock('@/lib/social/lists', () => ({
  getUserLists: vi.fn(async (...args: unknown[]) => {
    getUserLists.calls.push(args)
    return state.lists
  }),
}))
// Con «Sala» las piezas llegan por next/dynamic: aquí, dobles que guardan lo que reciben.
vi.mock('@/components/lists/sala/SalaListsIndexLazy', () => ({
  SalaListsIndexLazy: (props: Record<string, unknown>) => {
    state.sala = props
    return <div data-sala-stub="index" />
  },
}))
vi.mock('@/components/lists/sala/SalaListsSkeletonLazy', () => ({
  SalaListsSkeletonLazy: (props: Record<string, unknown>) => <div data-sala-stub="skeleton" data-props={JSON.stringify(props)} />,
}))

import ListsPage from '@/app/[locale]/(app)/lists/page'
import ListsLoading from '@/app/[locale]/(app)/lists/loading'
import { ListsClient } from '@/app/[locale]/(app)/lists/ListsClient'

function list(i: number, extra: Partial<List> = {}): List {
  return {
    id: `list-${i}`,
    ownerId: 'u1',
    name: `Lista ${i}`,
    mediaType: 'movie',
    isCollaborative: false,
    isPublic: false,
    createdAt: '2026-01-01',
    owner: { id: 'u1', username: 'benevi', avatarColor: '#f00', avatarInitials: 'BE', createdAt: '' },
    itemCount: i,
    ...extra,
  }
}

const LISTS: List[] = [
  list(1),
  list(2, { mediaType: 'mixed', template: 'franchise', isCollaborative: true, isPublic: true }),
  list(3, { mediaType: 'game', template: 'ranking', owner: undefined, itemCount: undefined }),
  list(4, { mediaType: 'podcast' as List['mediaType'], name: '転生したらスライムだった件' }),
]

async function renderPage(): Promise<string> {
  const el = (await ListsPage()) as ReactElement
  return render(el).container.innerHTML
}

beforeEach(() => {
  state.lists = LISTS
  state.userId = 'u1'
  state.sala = null
  getUserLists.calls = []
  delete process.env.SALA_LISTAS
})
afterEach(() => {
  delete process.env.SALA_LISTAS
})

describe('/lists sin «Sala» (SALA_LISTAS apagada): marcado de hoy', () => {
  it('índice con tarjetas', async () => {
    expect(await renderPage()).toMatchSnapshot()
    // La consulta de siempre: sin portadas.
    expect(getUserLists.calls).toEqual([['u1']])
  })

  it('sin listas', async () => {
    state.lists = []
    expect(await renderPage()).toMatchSnapshot()
  })

  it('con SALA_LISTAS=0 tampoco hay «Sala»', async () => {
    process.env.SALA_LISTAS = '0'
    const html = await renderPage()
    expect(html).not.toContain('data-sala')
    state.lists = LISTS
    delete process.env.SALA_LISTAS
    expect(html).toBe(await renderPage())
  })

  it('ListsClient pinta lo mismo que la página', () => {
    const { container } = render(<ListsClient lists={LISTS} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('esqueleto de loading.tsx', async () => {
    const html = renderToStaticMarkup((await ListsLoading()) as ReactElement)
    expect(html).toMatchSnapshot()
    expect(html).not.toContain('data-sala')
  })

  it('sin sesión, a /login', async () => {
    state.userId = null
    await expect(ListsPage()).rejects.toThrow('NEXT_REDIRECT')
  })
})

describe('/lists con «Sala» (SALA_LISTAS=1)', () => {
  beforeEach(() => {
    process.env.SALA_LISTAS = '1'
  })

  it('el índice de «Sala» sustituye al de hoy, con las portadas y quién mira', async () => {
    const html = await renderPage()
    expect(html).toBe('<div data-sala-stub="index"></div>')
    expect(getUserLists.calls).toEqual([['u1', { covers: true }]])
    expect(state.sala).toEqual({ lists: LISTS, viewerId: 'u1' })
  })

  it('loading.tsx pinta el esqueleto de «Sala» con el aviso de carga', async () => {
    const html = renderToStaticMarkup((await ListsLoading()) as ReactElement)
    expect(html).toBe('<div data-sala-stub="skeleton" data-props="{&quot;loadingLabel&quot;:&quot;common.loading&quot;}"></div>')
  })

  it('sin sesión, a /login también', async () => {
    state.userId = null
    await expect(ListsPage()).rejects.toThrow('NEXT_REDIRECT')
  })
})
