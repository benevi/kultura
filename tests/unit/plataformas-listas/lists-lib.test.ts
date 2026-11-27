// ============================================================
// F-25 — src/lib/social/lists.ts: orden de los títulos, lecturas y los
// extras de la lista pública.
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { fakeSupabase, opsOf, type FakeClient } from './fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))

const LIST_ROW = {
  id: 'l1', owner_id: 'u1', name: 'Dune', media_type: 'mixed', is_collaborative: false, is_public: true,
  created_at: '2026-10-01', description: 'Todo Dune', template: 'franchise',
  owner: { id: 'u1', username: 'benevi', avatar_color: 'blue', avatar_initials: 'BE' },
}
const item = (id: string, position: number | null, addedAt: string, note: string | null = null) => ({
  id, list_id: 'l1', media_id: `book_${id}`, added_by: 'u1', added_at: addedAt, position, note,
  media: { id: `book_${id}`, title: id, poster: null, type: 'book', year: 1965 }, added_by_user: null,
})

describe('sortListItems', () => {
  it('posición manual primero; sin ella, lo más reciente primero', async () => {
    const { sortListItems } = await import('@/lib/social/lists')
    const out = sortListItems([
      { id: 'a', position: null, addedAt: '2026-01-01' },
      { id: 'b', position: 1, addedAt: '2026-01-01' },
      { id: 'c', position: 0, addedAt: '2025-01-01' },
      { id: 'd', position: null, addedAt: '2026-05-01' },
    ])
    expect(out.map((i) => i.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('getListDetail', () => {
  it('pide orden, nota, descripción y plantilla, y devuelve el orden manual', async () => {
    client = fakeSupabase({
      tables: {
        lists: [{ data: LIST_ROW, error: null }],
        list_items: [{ data: [item('x', 2, '2026-01-03'), item('y', 0, '2026-01-01', 'Empieza aquí'), item('z', 1, '2026-01-02')], error: null }],
        list_members: [{ data: [], error: null }],
      },
    })
    const { getListDetail } = await import('@/lib/social/lists')
    const detail = await getListDetail('l1')
    expect(detail?.list).toMatchObject({ mediaType: 'mixed', description: 'Todo Dune', template: 'franchise', itemCount: 3 })
    expect(detail?.items.map((i) => i.id)).toEqual(['y', 'z', 'x'])
    expect(detail?.items[0].note).toBe('Empieza aquí')
    expect(String(opsOf(client, 'list_items', 'select')[0].args[0])).toContain('position, note')
    expect(opsOf(client, 'list_items', 'order')[0].args[0]).toBe('position')
  })

  it('no pide ni devuelve quién añadió cada título (va entero al navegador)', async () => {
    client = fakeSupabase({
      tables: {
        lists: [{ data: LIST_ROW, error: null }],
        list_items: [{ data: [{ ...item('x', 0, '2026-01-03'), added_by: 'otra-persona' }], error: null }],
        list_members: [{ data: [], error: null }],
      },
    })
    const { getListDetail } = await import('@/lib/social/lists')
    const detail = await getListDetail('l1')
    expect(String(opsOf(client, 'list_items', 'select')[0].args[0])).not.toContain('added_by')
    expect(detail?.items[0]).not.toHaveProperty('addedBy')
    expect(JSON.stringify(detail?.items)).not.toContain('otra-persona')
  })

})

describe('getPublicListExtras', () => {
  it('descripción, plantilla y posición/nota por título (solo listas públicas)', async () => {
    client = fakeSupabase({
      tables: {
        lists: [{ data: { description: 'd', template: 'ranking' }, error: null }],
        list_items: [{ data: [{ media_id: 'book_1', position: 0, note: 'n' }], error: null }],
      },
    })
    const { getPublicListExtras } = await import('@/lib/social/lists')
    const extras = await getPublicListExtras('l1')
    expect(extras?.template).toBe('ranking')
    expect(extras?.items.get('book_1')).toEqual({ position: 0, note: 'n' })
    expect(opsOf(client, 'lists', 'eq')).toContainEqual({ name: 'eq', args: ['is_public', true] })
  })

  it('migración sin aplicar: null', async () => {
    client = fakeSupabase({
      tables: {
        lists: [{ data: null, error: { code: '42703', message: 'x' } }],
        list_items: [{ data: null, error: { code: '42703', message: 'x' } }],
      },
    })
    const { getPublicListExtras } = await import('@/lib/social/lists')
    expect(await getPublicListExtras('l1')).toBeNull()
  })
})

describe('getUserLists', () => {
  const row = (id: string, extra: Record<string, unknown> = {}) => ({
    list_id: id,
    position: null,
    added_at: '2026-01-01',
    media: { title: `t-${id}`, poster: `p-${id}`, type: 'movie' },
    ...extra,
  })

  it('sin opciones, cuenta los títulos con la consulta de siempre y sin portadas', async () => {
    client = fakeSupabase({
      tables: {
        lists: [{ data: [LIST_ROW], error: null }],
        list_members: [{ data: [], error: null }],
        list_items: [{ data: [{ list_id: 'l1' }, { list_id: 'l1' }], error: null }],
      },
    })
    const { getUserLists } = await import('@/lib/social/lists')
    const lists = await getUserLists('u1')
    expect(lists).toHaveLength(1)
    expect(lists[0].itemCount).toBe(2)
    expect(lists[0]).not.toHaveProperty('covers')
    const items = client.calls.find((c) => c.table === 'list_items')!
    expect(items.ops.find((o) => o.name === 'select')?.args[0]).toBe('list_id')
  })

  it('con `covers` (fase 8.5 L1), las cuatro primeras portadas en el orden de la lista', async () => {
    const MEMBER = { ...LIST_ROW, id: 'l2', owner_id: 'u2', owner: { ...LIST_ROW.owner, id: 'u2', username: 'lucia' } }
    client = fakeSupabase({
      tables: {
        lists: [{ data: [LIST_ROW], error: null }],
        list_members: [{ data: [{ list_id: 'l2', list: MEMBER }], error: null }],
        list_items: [
          {
            data: [
              row('l1', { position: 3, media: { title: 'D', poster: 'd', type: 'movie' } }),
              row('l1', { position: 0, media: { title: 'A', poster: null, type: 'game' } }),
              row('l1', { position: 4, media: { title: 'E', poster: 'e', type: 'movie' } }),
              row('l1', { position: 1, media: null }),
              row('l1', { position: 2, media: { title: 'B', poster: 'b', type: 'book' } }),
              row('l1', { position: 5, media: { title: 'F', poster: 'f', type: 'movie' } }),
            ],
            error: null,
          },
        ],
      },
    })
    const { getUserLists } = await import('@/lib/social/lists')
    const lists = await getUserLists('u1', { covers: true })
    expect(lists.map((l) => l.id)).toEqual(['l1', 'l2'])
    // Seis filas (una sin título en `media`): cuentan las seis; portadas, las cuatro primeras con título.
    expect(lists[0].itemCount).toBe(6)
    expect(lists[0].covers).toEqual([
      { title: 'A', poster: null, type: 'game' },
      { title: 'B', poster: 'b', type: 'book' },
      { title: 'D', poster: 'd', type: 'movie' },
      { title: 'E', poster: 'e', type: 'movie' },
    ])
    expect(lists[1].covers).toEqual([])
    const items = client.calls.find((c) => c.table === 'list_items')!
    expect(items.ops.find((o) => o.name === 'select')?.args[0]).toBe('list_id, position, added_at, media:media_id(title, poster, type)')
  })
})
