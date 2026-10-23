// ============================================================
// KULTURA — "Popular en tu círculo" respeta "solo yo" (D-04b, F-12)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  users: { data: null as unknown, error: null as unknown },
  mediaIn: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'friendships') {
        const c = { select: () => c, eq: () => c, or: async () => ({
          data: [
            { requester_id: 'me', receiver_id: 'ana' },
            { requester_id: 'bea', receiver_id: 'me' },
          ],
          error: null,
        }) }
        return c
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => h.users }) }
      }
      // user_media: la propia (eq) y la de los amigos (in → in)
      const c: Record<string, unknown> = {}
      c.select = () => c
      c.eq = async () => ({ data: [], error: null })
      c.in = (col: string, values: string[]) => {
        if (col === 'user_id') h.mediaIn(values)
        return col === 'status' ? Promise.resolve({ data: [], error: null }) : c
      }
      return c
    },
  }),
}))

import { getPopularInCircle } from '@/lib/social/circle'

describe('getPopularInCircle — visibilidad', () => {
  beforeEach(() => vi.clearAllMocks())

  it('un amigo con la biblioteca en "solo yo" no se consulta', async () => {
    h.users = {
      data: [
        { id: 'ana', library_visibility: 'private' },
        { id: 'bea', library_visibility: 'friends' },
      ],
      error: null,
    }
    await getPopularInCircle('me')
    expect(h.mediaIn).toHaveBeenCalledWith(['bea'])
  })

  it('si todos son "solo yo" ni siquiera se pide la biblioteca', async () => {
    h.users = { data: [{ id: 'ana', library_visibility: 'private' }, { id: 'bea', library_visibility: 'private' }], error: null }
    expect(await getPopularInCircle('me')).toEqual([])
    expect(h.mediaIn).not.toHaveBeenCalled()
  })

  it('sin la columna (migración sin aplicar) cuentan todos, como antes', async () => {
    h.users = { data: null, error: { code: '42703' } }
    await getPopularInCircle('me')
    expect(h.mediaIn).toHaveBeenCalledWith(['ana', 'bea'])
  })
})
