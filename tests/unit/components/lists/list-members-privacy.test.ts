// ============================================================
// KULTURA — /lists/[id]: los miembros de una colaborativa solo los ven (y
// solo se mandan a) su dueño y sus miembros (riesgo R1 de Listas).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement } from 'react'

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  detail: null as unknown,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/social/lists', () => ({
  getListDetail: async () => h.detail,
  canEditList: async () => false,
}))
vi.mock('@/lib/social/friends', () => ({ getFriends: async () => [] }))
vi.mock('@/app/[locale]/(app)/lists/[id]/ListDetail', () => ({ ListDetail: () => null }))

import { canSeeListMembers } from '@/app/[locale]/(app)/lists/[id]/list-detail-utils'

const LIST = { id: 'l1', ownerId: 'owner', name: 'Pelis', isCollaborative: true, isPublic: true }
const MEMBERS = [{ listId: 'l1', userId: 'bea', user: { id: 'bea', username: 'bea' } }]

describe('canSeeListMembers', () => {
  it('el dueño y los miembros, sí; los demás y sin sesión, no', () => {
    expect(canSeeListMembers(LIST, MEMBERS, 'owner')).toBe(true)
    expect(canSeeListMembers(LIST, MEMBERS, 'bea')).toBe(true)
    expect(canSeeListMembers(LIST, MEMBERS, 'otro')).toBe(false)
    expect(canSeeListMembers(LIST, MEMBERS, '')).toBe(false)
    expect(canSeeListMembers(LIST, MEMBERS, null)).toBe(false)
  })
})

async function pageProps() {
  const { default: Page } = await import('@/app/[locale]/(app)/lists/[id]/page')
  const tree = (await Page({ params: Promise.resolve({ locale: 'es', id: 'l1' }) })) as ReactElement<{
    children: ReactElement<{ members: unknown[] }>
  }>
  const detail = tree.props.children
  expect(isValidElement(detail)).toBe(true)
  return detail.props
}

describe('/lists/[id]: qué miembros se mandan al cliente', () => {
  beforeEach(() => {
    h.detail = { list: LIST, items: [], members: MEMBERS }
  })

  it('a quien no es dueño ni miembro (lista pública ajena), ninguno', async () => {
    h.user = { id: 'otro' }
    const props = await pageProps()
    expect(props.members).toEqual([])
    expect(JSON.stringify(props)).not.toContain('bea')
  })

  it('al dueño y a los miembros, todos', async () => {
    h.user = { id: 'owner' }
    expect((await pageProps()).members).toEqual(MEMBERS)
    h.user = { id: 'bea' }
    expect((await pageProps()).members).toEqual(MEMBERS)
  })
})
