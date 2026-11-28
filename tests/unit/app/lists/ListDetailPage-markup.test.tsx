// ============================================================
// KULTURA — /lists/[id]: HTML de la página (caracterización, fase 8.5 L3).
//
// Fija lo que pinta hoy la ficha de una lista en el servidor (qué recibe
// `ListDetail` según quién mira: dueño, quien colabora, quien no es miembro
// de una pública, sin sesión; amigos; miembros solo para dueño y miembros;
// `notFound`) y el esqueleto de `loading.tsx`, para que la bandera
// `SALA_LISTAS` apagada lo deje EXACTAMENTE igual. `ListDetail` es un doble
// que escribe sus props (su HTML ya lo fija `ListDetail-markup.test.tsx`).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import type { List, ListItem, ListMember } from '@/types/list'

const { state } = vi.hoisted(() => ({
  state: {
    userId: 'u1' as string | null,
    detail: null as { list: List; items: ListItem[]; members: ListMember[] } | null,
    canEdit: true,
    calls: [] as string[],
    sala: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (ns?: string) => (k: string) => `${ns}.${k}`),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) },
  })),
}))
vi.mock('@/lib/social/lists', () => ({
  getListDetail: vi.fn(async () => {
    state.calls.push('getListDetail')
    return state.detail
  }),
  canEditList: vi.fn(async () => {
    state.calls.push('canEditList')
    return state.canEdit
  }),
}))
vi.mock('@/lib/social/friends', () => ({
  getFriends: vi.fn(async () => {
    state.calls.push('getFriends')
    return [
      { otherUser: { id: 'u3', username: 'cris', avatarColor: 'blue', avatarInitials: 'CR' } },
      { otherUser: undefined },
    ]
  }),
}))
vi.mock('@/app/[locale]/(app)/lists/[id]/ListDetail', () => ({
  ListDetail: (props: Record<string, unknown>) => <div data-stub="ListDetail" data-props={JSON.stringify(props)} />,
}))
// Con «Sala» la ficha llega por next/dynamic: aquí, dobles que guardan lo que reciben.
vi.mock('@/components/lists/sala/SalaListDetailLazy', () => ({
  SalaListDetailLazy: (props: Record<string, unknown>) => {
    state.sala = props
    return <div data-sala-stub="detail" />
  },
}))
vi.mock('@/components/lists/sala/SalaListDetailSkeletonLazy', () => ({
  SalaListDetailSkeletonLazy: (props: Record<string, unknown>) => (
    <div data-sala-stub="skeleton" data-props={JSON.stringify(props)} />
  ),
}))

import ListDetailPage, { generateMetadata } from '@/app/[locale]/(app)/lists/[id]/page'
import ListDetailLoading from '@/app/[locale]/(app)/lists/[id]/loading'

const ANA = { id: 'u1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', createdAt: '' }
const BEA = { id: 'u2', username: 'bea', avatarColor: 'lime', avatarInitials: 'BE', createdAt: '' }

function detail(over: Partial<List> = {}, members: ListMember[] = []) {
  const list: List = {
    id: 'l1',
    ownerId: 'u1',
    name: 'Dune',
    mediaType: 'mixed',
    isCollaborative: true,
    isPublic: true,
    createdAt: '2026-01-01',
    description: 'Todo Dune',
    template: 'franchise',
    owner: ANA,
    itemCount: 1,
    ...over,
  }
  const items: ListItem[] = [{ id: 'i1', listId: 'l1', mediaId: 'book_1', addedAt: '2026-01-01', position: 0, note: null }]
  return { list, items, members }
}

const params = Promise.resolve({ locale: 'es', id: 'l1' })

async function renderPage(): Promise<string> {
  return renderToStaticMarkup((await ListDetailPage({ params })) as ReactElement)
}

beforeEach(() => {
  state.userId = 'u1'
  state.detail = detail({}, [{ listId: 'l1', userId: 'u2', user: BEA }])
  state.canEdit = true
  state.calls = []
  state.sala = null
  delete process.env.SALA_LISTAS
})
afterEach(() => {
  delete process.env.SALA_LISTAS
})

describe('/lists/[id] sin «Sala» (SALA_LISTAS apagada): marcado de hoy', () => {
  it('el dueño: miembros, amigos y puede editar', async () => {
    expect(await renderPage()).toMatchSnapshot()
    expect(state.calls).toEqual(['getListDetail', 'canEditList', 'getFriends'])
  })

  it('quien colabora', async () => {
    state.userId = 'u2'
    expect(await renderPage()).toMatchSnapshot()
  })

  it('quien no es miembro de una pública: sin miembros ni edición', async () => {
    state.userId = 'u9'
    state.canEdit = false
    expect(await renderPage()).toMatchSnapshot()
  })

  it('sin sesión', async () => {
    state.userId = null
    expect(await renderPage()).toMatchSnapshot()
    expect(state.calls).toEqual(['getListDetail'])
  })

  it('con SALA_LISTAS=0 tampoco hay «Sala»', async () => {
    process.env.SALA_LISTAS = '0'
    const html = await renderPage()
    expect(html).not.toContain('data-sala')
    delete process.env.SALA_LISTAS
    expect(html).toBe(await renderPage())
  })

  it('lista que no existe (o que no se puede ver): notFound', async () => {
    state.detail = null
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('título de la pestaña', async () => {
    expect(await generateMetadata({ params })).toEqual({ title: 'Dune' })
    state.detail = null
    expect(await generateMetadata({ params })).toEqual({ title: 'lists.metaFallback' })
  })

  it('esqueleto de loading.tsx', async () => {
    const html = renderToStaticMarkup((await ListDetailLoading()) as ReactElement)
    expect(html).toMatchSnapshot()
    expect(html).not.toContain('data-sala')
  })
})

describe('/lists/[id] con «Sala» (SALA_LISTAS=1)', () => {
  beforeEach(() => {
    process.env.SALA_LISTAS = '1'
  })

  it('el dueño de una colaborativa: ficha «Sala», edita y recibe sus amigos', async () => {
    const html = await renderPage()
    expect(html).toBe('<div data-sala-stub="detail"></div>')
    expect(state.calls).toEqual(['getListDetail', 'getFriends'])
    expect(state.sala).toMatchObject({
      currentUserId: 'u1',
      canEdit: true,
      members: [{ userId: 'u2' }],
      currentUserFriends: [{ id: 'u3', username: 'cris', avatarColor: 'blue', avatarInitials: 'CR' }],
      toastLabels: {
        region: 'media_detail.salaToastRegion',
        dismiss: 'media_detail.salaToastDismiss',
        hint: 'media_detail.salaToastHint',
      },
    })
  })

  it('el dueño de una lista no colaborativa: sin pedir amigos', async () => {
    state.detail = detail({ isCollaborative: false })
    await renderPage()
    expect(state.calls).toEqual(['getListDetail'])
    expect(state.sala).toMatchObject({ canEdit: true, currentUserFriends: [] })
  })

  it('quien colabora: edita, sin amigos (no invita)', async () => {
    state.userId = 'u2'
    await renderPage()
    expect(state.calls).toEqual(['getListDetail'])
    expect(state.sala).toMatchObject({ currentUserId: 'u2', canEdit: true, currentUserFriends: [] })
  })

  it('quien no es miembro de una pública va a su página pública', async () => {
    state.userId = 'u9'
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_REDIRECT /es/u/ana/l/l1')
    expect(state.sala).toBeNull()
  })

  it('sin sesión, también a la pública', async () => {
    state.userId = null
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_REDIRECT /es/u/ana/l/l1')
  })

  it('quien no es miembro de una privada (o sin dueño embebido): notFound', async () => {
    state.userId = 'u9'
    state.detail = detail({ isPublic: false })
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
    state.detail = detail({ owner: undefined })
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('lista que no existe: notFound', async () => {
    state.detail = null
    await expect(ListDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('esqueleto de «Sala» en loading.tsx', async () => {
    const html = renderToStaticMarkup((await ListDetailLoading()) as ReactElement)
    expect(html).toContain('data-sala-stub="skeleton"')
    expect(html).toContain('common.loading')
  })
})
