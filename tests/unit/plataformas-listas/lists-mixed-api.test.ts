// ============================================================
// F-25 — Listas mixtas, orden manual y notas en /api/lists (PRO-10).
// Con MIXED_LISTS apagada todo responde como antes; encendida, la lista
// admite `mixed`, descripción y plantilla, y se reordena en una sentencia.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fakeSupabase, opsOf, type FakeClient } from './fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  LIMITS: { lists: {} },
}))
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(async () => undefined) }))
vi.mock('@/lib/media/upsert-from-provider', () => ({
  upsertMediaFromProvider: vi.fn(async (id: string) => ({ ok: true, id, title: 'X', created: false })),
  mediaFailureStatus: () => ({ status: 502, error: 'x' }),
}))

const USER = { id: '00000000-0000-4000-8000-00000000000a' }
const LIST = '11111111-1111-4111-8111-111111111111'
const I1 = '22222222-2222-4222-8222-222222222221'
const I2 = '22222222-2222-4222-8222-222222222222'
const I3 = '22222222-2222-4222-8222-222222222223'
const params = { params: Promise.resolve({ id: LIST }) }

function req(method: string, body: unknown, url = `http://localhost/api/lists/${LIST}`): Request {
  return new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function ownerList(mediaType = 'mixed') {
  return { data: { owner_id: USER.id, is_collaborative: false, media_type: mediaType }, error: null }
}

afterEach(() => {
  delete process.env.MIXED_LISTS
})

describe('POST /api/lists — tipo, descripción y plantilla', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin la bandera, `mixed` es un tipo inválido (400) y no se escribe nada', async () => {
    client = fakeSupabase({ user: USER })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req('POST', { name: 'Dune', mediaType: 'mixed' }, 'http://localhost/api/lists'))
    expect(res.status).toBe(400)
    expect(opsOf(client, 'lists', 'insert')).toHaveLength(0)
  })

  it('sin la bandera, descripción y plantilla se ignoran (columnas que quizá no existen)', async () => {
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: null, error: null }] } })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req('POST', { name: 'Top', mediaType: 'movie', description: 'd', template: 'ranking' }, 'http://localhost/api/lists'))
    expect(res.status).toBe(201)
    const inserted = opsOf(client, 'lists', 'insert')[0].args[0] as Record<string, unknown>
    expect(inserted).not.toHaveProperty('description')
    expect(inserted).not.toHaveProperty('template')
  })

  it('con la bandera crea una «Franquicia» mixta con descripción', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: null, error: null }] } })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req('POST', {
      name: 'Dune', mediaType: 'mixed', template: 'franchise', description: '  Libro, películas y juego  ',
    }, 'http://localhost/api/lists'))
    expect(res.status).toBe(201)
    const inserted = opsOf(client, 'lists', 'insert')[0].args[0] as Record<string, unknown>
    expect(inserted).toMatchObject({ media_type: 'mixed', template: 'franchise', description: 'Libro, películas y juego', is_public: false })
  })

  it('rechaza plantilla desconocida, descripción larga y nombre largo', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER })
    const { POST } = await import('@/app/api/lists/route')
    const url = 'http://localhost/api/lists'
    expect((await POST(req('POST', { name: 'X', mediaType: 'movie', template: 'top10' }, url))).status).toBe(400)
    expect((await POST(req('POST', { name: 'X', mediaType: 'movie', description: 'x'.repeat(501) }, url))).status).toBe(400)
    expect((await POST(req('POST', { name: 'x'.repeat(81), mediaType: 'movie' }, url))).status).toBe(400)
  })

  it('bandera encendida antes de migrar: columna que falta → crea sin ella', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({
      user: USER,
      tables: { lists: [{ data: null, error: { code: 'PGRST204', message: 'column' } }, { data: null, error: null }] },
    })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req('POST', { name: 'X', mediaType: 'movie', description: 'd' }, 'http://localhost/api/lists'))
    expect(res.status).toBe(201)
    const inserts = opsOf(client, 'lists', 'insert')
    expect(inserts).toHaveLength(2)
    expect(inserts[1].args[0]).not.toHaveProperty('description')
  })

  it('bandera encendida antes de migrar: `mixed` choca con el CHECK viejo → 409 mixed_unavailable', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: null, error: { code: '23514', message: 'check' } }] } })
    const { POST } = await import('@/app/api/lists/route')
    const res = await POST(req('POST', { name: 'X', mediaType: 'mixed' }, 'http://localhost/api/lists'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('mixed_unavailable')
  })
})

describe('GET /api/lists?mediaType=', () => {
  it('con la bandera, ofrece también las mixtas', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: [], error: null }] } })
    const { GET } = await import('@/app/api/lists/route')
    await GET(new Request('http://localhost/api/lists?mediaType=book'))
    expect(opsOf(client, 'lists', 'in')).toContainEqual({ name: 'in', args: ['media_type', ['book', 'mixed']] })
    expect(String(opsOf(client, 'lists', 'select')[0].args[0])).toContain('description')
  })

  it('sin la bandera, el filtro y las columnas de siempre', async () => {
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: [], error: null }] } })
    const { GET } = await import('@/app/api/lists/route')
    await GET(new Request('http://localhost/api/lists?mediaType=book'))
    expect(opsOf(client, 'lists', 'eq')).toContainEqual({ name: 'eq', args: ['media_type', 'book'] })
    expect(String(opsOf(client, 'lists', 'select')[0].args[0])).not.toContain('description')
  })

  it('bandera antes de migrar: reintenta con las columnas viejas', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({
      user: USER,
      tables: { lists: [{ data: null, error: { code: '42703', message: 'no column' } }, { data: [{ id: 'l' }], error: null }] },
    })
    const { GET } = await import('@/app/api/lists/route')
    const res = await GET(new Request('http://localhost/api/lists'))
    expect(res.status).toBe(200)
    expect((await res.json()).lists).toEqual([{ id: 'l' }])
  })
})

describe('POST /api/lists/[id] — formato del título', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista de películas: un libro → 400 type_mismatch', async () => {
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList('movie')] } })
    const { POST } = await import('@/app/api/lists/[id]/route')
    const res = await POST(req('POST', { mediaId: 'book_abc' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('type_mismatch')
  })

  it('lista mixta: libro, película y juego entran', async () => {
    const { POST } = await import('@/app/api/lists/[id]/route')
    for (const mediaId of ['book_abc', 'movie_550', 'game_3498']) {
      client = fakeSupabase({
        user: USER,
        tables: {
          lists: [ownerList('mixed')],
          list_items: [
            (call) => call.ops.some((o) => o.name === 'insert')
              ? { data: { id: I1, list_id: LIST, media_id: mediaId }, error: null }
              : { data: null, error: null },
          ],
        },
      })
      const res = await POST(req('POST', { mediaId }), params)
      expect(res.status).toBe(201)
    }
  })
})

describe('PATCH /api/lists/[id] — orden manual', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin la bandera: 404 not_available y no llama a la base', async () => {
    client = fakeSupabase({ user: USER })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { order: [I1, I2] }), params)
    expect(res.status).toBe(404)
    expect(client.rpcCalls).toHaveLength(0)
  })

  it('guarda el orden completo con una sola llamada a reorder_list_items', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()] }, rpc: { reorder_list_items: { data: 3, error: null } } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { order: [I3, I1, I2] }), params)
    expect(res.status).toBe(200)
    expect(client.rpcCalls).toEqual([{ fn: 'reorder_list_items', args: { p_list: LIST, p_items: [I3, I1, I2] } }])
    expect(await res.json()).toEqual({ ok: true, moved: 3 })
  })

  it('valida: vacío, repetidos, no uuid', async () => {
    process.env.MIXED_LISTS = '1'
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    for (const order of [[], [I1, I1], ['x'], 'nope']) {
      client = fakeSupabase({ user: USER, tables: { lists: [ownerList()] } })
      const res = await PATCH(req('PATCH', { order }), params)
      expect(res.status).toBe(400)
    }
  })

  it('quien no puede editar: 403', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({
      user: USER,
      tables: { lists: [{ data: { owner_id: 'otro', is_collaborative: false, media_type: 'mixed' }, error: null }] },
    })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { order: [I1] }), params)
    expect(res.status).toBe(403)
    expect(client.rpcCalls).toHaveLength(0)
  })

  it('miembro de una colaborativa: puede', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({
      user: USER,
      tables: {
        lists: [{ data: { owner_id: 'otro', is_collaborative: true, media_type: 'mixed' }, error: null }],
        list_members: [{ data: { user_id: USER.id }, error: null }],
      },
      rpc: { reorder_list_items: { data: 1, error: null } },
    })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { order: [I1] }), params)
    expect(res.status).toBe(200)
  })

  it('bandera antes de migrar (no existe la función): 409 not_available', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()] } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { order: [I1] }), params)
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/lists/[id] — nota y datos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('guarda una nota recortada (y vacía → null)', async () => {
    process.env.MIXED_LISTS = '1'
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()], list_items: [{ data: null, error: null, count: 1 }] } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(req('PATCH', { itemId: I1, note: '  La mejor  ' }), params)
    expect(res.status).toBe(200)
    expect(opsOf(client, 'list_items', 'update')[0].args[0]).toEqual({ note: 'La mejor' })

    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()], list_items: [{ data: null, error: null, count: 1 }] } })
    await PATCH(req('PATCH', { itemId: I1, note: '   ' }), params)
    expect(opsOf(client, 'list_items', 'update')[0].args[0]).toEqual({ note: null })
  })

  it('nota de más de 500 → 400; título que no es de la lista → 404', async () => {
    process.env.MIXED_LISTS = '1'
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()] } })
    expect((await PATCH(req('PATCH', { itemId: I1, note: 'x'.repeat(501) }), params)).status).toBe(400)
    client = fakeSupabase({ user: USER, tables: { lists: [ownerList()], list_items: [{ data: null, error: null, count: 0 }] } })
    expect((await PATCH(req('PATCH', { itemId: I1, note: 'hola' }), params)).status).toBe(404)
  })

  it('el dueño cambia nombre y descripción; un miembro no', async () => {
    process.env.MIXED_LISTS = '1'
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    client = fakeSupabase({ user: USER, tables: { lists: [{ data: { owner_id: USER.id }, error: null }, { data: null, error: null }] } })
    const ok = await PATCH(req('PATCH', { name: ' Dune ', description: 'Todo Dune' }), params)
    expect(ok.status).toBe(200)
    expect(opsOf(client, 'lists', 'update')[0].args[0]).toEqual({ name: 'Dune', description: 'Todo Dune' })

    client = fakeSupabase({ user: USER, tables: { lists: [{ data: { owner_id: 'otro' }, error: null }] } })
    expect((await PATCH(req('PATCH', { description: 'x' }), params)).status).toBe(403)
  })

  it('cuerpo vacío sigue siendo 400 (compatibilidad)', async () => {
    client = fakeSupabase({ user: USER })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    expect((await PATCH(req('PATCH', {}), params)).status).toBe(400)
  })
})
