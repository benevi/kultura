// ============================================================
// F-25 — Regresiones de /api/lists que venían de oleadas anteriores:
//  1. Crear una lista con `.insert().select()` falla por la RLS de SELECT en
//     el RETURNING (can_read_list es STABLE y no ve la fila que inserta la
//     misma sentencia; comprobado en PostgreSQL 16 con las migraciones del
//     repo). Ahora: insert sin RETURNING con id propio + select aparte.
//  2. Invitar a un no-amigo a una lista daba 500 (la RLS de list_members lo
//     rechaza desde 20261023020001); ahora 403 con motivo.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, chained, opsOf, type FakeClient } from './fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  LIMITS: { lists: {} },
}))
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(async () => undefined) }))

const USER = { id: '00000000-0000-4000-8000-00000000000a' }
const FRIEND = '00000000-0000-4000-8000-00000000000b'

function req(body: unknown, headers: Record<string, string> = {}, url = 'http://localhost/api/lists'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/lists — crear sin depender del RETURNING', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserta sin .select() encadenado, con id propio, y lee la fila aparte', async () => {
    let insertedId = ''
    client = fakeSupabase({
      user: USER,
      tables: {
        lists: [
          (call) => {
            const ins = call.ops.find((o) => o.name === 'insert')
            if (ins) {
              insertedId = (ins.args[0] as { id: string }).id
              return { data: null, error: null }
            }
            return {
              data: {
                id: insertedId, owner_id: USER.id, name: 'Privada', media_type: 'movie',
                is_collaborative: false, is_public: false, created_at: '2026-10-26T00:00:00Z',
              },
              error: null,
            }
          },
        ],
      },
    })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req({ name: 'Privada', mediaType: 'movie' }))
    expect(res.status).toBe(201)
    expect(chained(client, 'lists', 'insert', 'select')).toBe(false)
    expect(insertedId).toMatch(/^[0-9a-f-]{36}$/)
    const body = await res.json()
    expect(body.list.id).toBe(insertedId)
    // La lectura posterior va por id.
    expect(opsOf(client, 'lists', 'eq')).toContainEqual({ name: 'eq', args: ['id', insertedId] })
  })

  it('si la relectura no devuelve nada, responde igual con lo insertado', async () => {
    client = fakeSupabase({
      user: USER,
      tables: { lists: [{ data: null, error: null }] },
    })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req({ name: 'Otra', mediaType: 'book', isPublic: true }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.list).toMatchObject({ name: 'Otra', media_type: 'book', is_public: true, owner_id: USER.id })
  })

  it('500 si el insert falla', async () => {
    client = fakeSupabase({
      user: USER,
      tables: { lists: [{ data: null, error: { code: '42501', message: 'rls' } }] },
    })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req({ name: 'X', mediaType: 'movie' }))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/lists/[id] (invite) — a quien no es amigo', () => {
  beforeEach(() => vi.clearAllMocks())
  const params = { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }

  function setup(friendship: unknown, memberError: { code: string } | null = { code: '42501' }) {
    client = fakeSupabase({
      user: USER,
      tables: {
        lists: [{ data: { owner_id: USER.id, is_collaborative: true, name: 'Peña' }, error: null }],
        users: [
          (call) => {
            const eq = call.ops.find((o) => o.name === 'eq')
            return eq?.args[1] === USER.id
              ? { data: { username: 'u_aaaaaa' }, error: null }
              : { data: { id: FRIEND }, error: null }
          },
        ],
        friendships: [{ data: friendship, error: null }],
        list_members: [{ data: null, error: memberError }],
      },
    })
  }

  it('403 con motivo, sin intentar el alta', async () => {
    setup(null)
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req({ userId: FRIEND }, { 'x-action': 'invite' }), params)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'not_friends', message: expect.any(String) })
    expect(opsOf(client, 'list_members', 'upsert')).toHaveLength(0)
  })

  it('si la RLS lo rechaza igualmente (amistad borrada entretanto), 403 y no 500', async () => {
    setup({ id: 'f1' }, { code: '42501' })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req({ userId: FRIEND }, { 'x-action': 'invite' }), params)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('not_friends')
  })

  it('amigo: 201', async () => {
    setup({ id: 'f1' }, null)
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req({ userId: FRIEND }, { 'x-action': 'invite' }), params)
    expect(res.status).toBe(201)
  })
})
