// ============================================================
// KULTURA — GET /api/chat/[id]: los últimos mensajes (saneamiento 1.3)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }
})

const USER = { id: 'u-1' }
let member: unknown = { user_id: 'u-1' }
let messageRows: { id: string; created_at: string }[] = []
const calls: { table: string; method: string; args: unknown[] }[] = []

function chain(table: string, result: () => unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'lt', 'order', 'limit', 'update']) {
    c[m] = vi.fn((...args: unknown[]) => {
      calls.push({ table, method: m, args })
      return c
    })
  }
  c.maybeSingle = vi.fn(async () => result())
  c.then = (resolve: (v: unknown) => void) => resolve(result())
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: USER } }) },
    from: (table: string) =>
      table === 'messages'
        ? chain(table, () => ({ data: messageRows, error: null }))
        : chain(table, () => ({ data: member, error: null })),
  }),
}))

/** `n` mensajes en orden DESCENDENTE (como los devuelve la consulta). */
function rowsDesc(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${n - i}`,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, n - i)).toISOString(),
  }))
}

async function get(query = '') {
  const { GET } = await import('@/app/api/chat/[id]/route')
  const res = await GET(new NextRequest(`http://localhost/api/chat/c-1${query}`), {
    params: Promise.resolve({ id: 'c-1' }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

describe('GET /api/chat/[id]', () => {
  beforeEach(() => {
    calls.length = 0
    member = { user_id: 'u-1' }
    messageRows = []
  })

  it('pide los más recientes (desc, 101) y los devuelve en orden cronológico', async () => {
    messageRows = rowsDesc(3)
    const { status, json } = await get()
    expect(status).toBe(200)
    const msgCalls = calls.filter((c) => c.table === 'messages')
    expect(msgCalls).toContainEqual({ table: 'messages', method: 'order', args: ['created_at', { ascending: false }] })
    expect(msgCalls).toContainEqual({ table: 'messages', method: 'limit', args: [101] })
    expect((json.messages as { id: string }[]).map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(json.hasMore).toBe(false)
  })

  it('con 101 filas: devuelve 100 (los últimos) y hasMore', async () => {
    messageRows = rowsDesc(101)
    const { json } = await get()
    const ids = (json.messages as { id: string }[]).map((m) => m.id)
    expect(ids).toHaveLength(100)
    expect(ids[0]).toBe('m2')
    expect(ids[99]).toBe('m101')
    expect(json.hasMore).toBe(true)
  })

  it('?before= filtra por fecha y no marca la conversación como leída', async () => {
    messageRows = rowsDesc(2)
    const before = '2026-01-01T00:00:50.000Z'
    await get(`?before=${encodeURIComponent(before)}`)
    expect(calls).toContainEqual({ table: 'messages', method: 'lt', args: ['created_at', before] })
    expect(calls.some((c) => c.method === 'update')).toBe(false)
  })

  it('al abrir sí marca como leída', async () => {
    await get()
    expect(calls.some((c) => c.table === 'conversation_members' && c.method === 'update')).toBe(true)
  })

  it('?before= inválido → 400', async () => {
    const { status } = await get('?before=ayer')
    expect(status).toBe(400)
  })

  it('sin ser miembro → 403', async () => {
    member = null
    const { status } = await get()
    expect(status).toBe(403)
  })
})
