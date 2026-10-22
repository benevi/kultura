// ============================================================
// KULTURA — /api/cron/daily: cron único (keep-alive + purga, F-12)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  health: vi.fn(),
  rows: { data: [] as unknown[], error: null as unknown },
  rpc: vi.fn(),
  deleteUser: vi.fn(),
  query: {} as Record<string, ReturnType<typeof vi.fn>>,
}))

vi.mock('@/app/api/health/route', () => ({ GET: h.health }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const c = h.query
      for (const m of ['select', 'not', 'lte', 'order']) c[m] = vi.fn(() => c)
      c.limit = vi.fn(async () => h.rows)
      return c
    },
    rpc: h.rpc,
    auth: { admin: { deleteUser: h.deleteUser } },
  }),
}))

import { GET, dynamic } from '@/app/api/cron/daily/route'
import { MAX_PURGE_PER_RUN } from '@/app/api/cron/daily/purge'

const SECRET = 's3cr3t-cron-value'
const call = (auth?: string) =>
  GET(new NextRequest('https://k.test/api/cron/daily', { headers: auth ? { authorization: auth } : {} }))

describe('GET /api/cron/daily', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
    h.health.mockResolvedValue(Response.json({ ok: true, db: 'up' }))
    h.rows = { data: [], error: null }
    h.rpc.mockResolvedValue({ data: { groups: 0, lists: 0 }, error: null })
    h.deleteUser.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it('nunca en caché', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('sin CRON_SECRET hace el keep-alive igual, pero no purga', async () => {
    delete process.env.CRON_SECRET
    h.rows = { data: [{ user_id: 'a' }], error: null }
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(h.health).toHaveBeenCalledOnce()
    expect((await res.json()).purge).toEqual({ status: 'not_configured' })
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.deleteUser).not.toHaveBeenCalled()
  })

  it.each([undefined, 'Bearer otro', `Bearer ${SECRET}x`, SECRET])(
    'con autorización %s: keep-alive sí, purga no',
    async (auth) => {
      h.rows = { data: [{ user_id: 'a' }], error: null }
      const res = await call(auth)
      expect(res.status).toBe(200)
      expect(h.health).toHaveBeenCalledOnce()
      expect((await res.json()).purge).toEqual({ status: 'unauthorized' })
      expect(h.rpc).not.toHaveBeenCalled()
      expect(h.deleteUser).not.toHaveBeenCalled()
    }
  )

  it('sin secreto y con la base caída, el código refleja la base (503)', async () => {
    h.health.mockResolvedValue(Response.json({ ok: false, db: 'down' }, { status: 503 }))
    const res = await call()
    expect(res.status).toBe(503)
  })

  it('llama por dentro a /api/health (keep-alive de Supabase)', async () => {
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect(h.health).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, health: { ok: true }, purge: { status: 'done', deleted: 0 } })
  })

  it('purga las cuentas con el borrado vencido: traspaso y después borrado', async () => {
    h.rows = { data: [{ user_id: 'a' }, { user_id: 'b' }], error: null }
    const res = await call(`Bearer ${SECRET}`)
    const body = await res.json()
    expect(body.purge).toEqual({ status: 'done', deleted: 2, failed: 0 })
    expect(h.rpc).toHaveBeenCalledWith('transfer_owned_content', { p_user: 'a' })
    expect(h.deleteUser).toHaveBeenCalledWith('a')
    expect(h.deleteUser).toHaveBeenCalledWith('b')
    // Solo lo que lleva 7 días o más, con tope por ejecución.
    const cutoff = Date.parse(h.query.lte.mock.calls[0][1])
    expect((Date.now() - cutoff) / 86_400_000).toBeCloseTo(7, 1)
    expect(h.query.limit).toHaveBeenCalledWith(MAX_PURGE_PER_RUN)
  })

  it('un traspaso que falla deja esa cuenta sin borrar y el cron en rojo', async () => {
    h.rows = { data: [{ user_id: 'a' }], error: null }
    h.rpc.mockResolvedValue({ data: null, error: { code: '40P01', message: 'deadlock' } })
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(500)
    expect(h.deleteUser).not.toHaveBeenCalled()
    expect((await res.json()).purge).toEqual({ status: 'done', deleted: 0, failed: 1 })
  })

  it('sin la migración la purga no aplica pero el keep-alive sí', async () => {
    h.rows = { data: null as unknown as unknown[], error: { code: '42P01', message: 'missing' } }
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(200)
    expect((await res.json()).purge.status).toBe('not_migrated')
  })

  it('base caída → 500 (que se vea en el panel de Vercel)', async () => {
    h.health.mockResolvedValue(Response.json({ ok: false, db: 'down' }, { status: 503 }))
    const res = await call(`Bearer ${SECRET}`)
    expect(res.status).toBe(500)
  })
})
