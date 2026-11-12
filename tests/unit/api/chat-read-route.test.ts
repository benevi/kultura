// ============================================================
// KULTURA — POST /api/chat/[id]/read (saneamiento 9.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

const CONV = '44444444-4444-4444-8444-444444444444'
let user: { id: string } | null = { id: 'u-1' }
let result: { data: unknown; error: unknown } = { data: [{ conversation_id: CONV }], error: null }
const calls: { table: string; method: string; args: unknown[] }[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ['update', 'eq']) {
        c[m] = (...args: unknown[]) => {
          calls.push({ table, method: m, args })
          return c
        }
      }
      c.select = async (...args: unknown[]) => {
        calls.push({ table, method: 'select', args })
        return result
      }
      return c
    },
  }),
}))

async function post(id = CONV) {
  const { POST } = await import('@/app/api/chat/[id]/read/route')
  const res = await POST(new Request(`http://localhost/api/chat/${id}/read`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  calls.length = 0
  user = { id: 'u-1' }
  result = { data: [{ conversation_id: CONV }], error: null }
})

describe('POST /api/chat/[id]/read', () => {
  it('401 sin sesión', async () => {
    user = null
    expect((await post()).status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('id que no es uuid: 404 sin tocar la base', async () => {
    expect((await post('no-uuid')).status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('marca leída solo la fila propia de esa conversación', async () => {
    const { status, json } = await post()
    expect(status).toBe(200)
    expect(json).toEqual({ data: null })
    expect(calls[0]).toMatchObject({ table: 'conversation_members', method: 'update' })
    expect((calls[0].args[0] as { last_read_at: string }).last_read_at).toEqual(expect.any(String))
    expect(calls).toContainEqual({ table: 'conversation_members', method: 'eq', args: ['conversation_id', CONV] })
    expect(calls).toContainEqual({ table: 'conversation_members', method: 'eq', args: ['user_id', 'u-1'] })
  })

  it('no es miembro (0 filas): 403', async () => {
    result = { data: [], error: null }
    expect((await post()).status).toBe(403)
  })

  it('error de la base: 500', async () => {
    result = { data: null, error: { code: 'x', message: 'boom' } }
    expect((await post()).status).toBe(500)
  })
})
