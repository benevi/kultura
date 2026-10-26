// ============================================================
// F-28 — /api/cron/daily: además del keep-alive y la purga, la retención de
// la analítica (purge_old_analytics_events, F-17) y el correo semanal.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  health: vi.fn(),
  rpc: vi.fn(),
  digest: vi.fn(),
}))

vi.mock('@/app/api/health/route', () => ({ GET: h.health }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'not', 'lte', 'order']) c[m] = () => c
    c.limit = async () => ({ data: [], error: null })
    return { from: () => c, rpc: h.rpc, auth: { admin: { deleteUser: vi.fn() } } }
  },
}))
vi.mock('@/lib/email/digest', async (orig) => ({
  ...(await orig<typeof import('@/lib/email/digest')>()),
  runWeeklyDigest: h.digest,
}))

import { GET, maxDuration } from '@/app/api/cron/daily/route'

const SECRET = 'cron-secret-value'
const call = () =>
  GET(new NextRequest('https://k.test/api/cron/daily', { headers: { authorization: `Bearer ${SECRET}` } }))

describe('cron diario (F-28)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
    h.health.mockResolvedValue(Response.json({ ok: true }))
    h.rpc.mockResolvedValue({ data: 3, error: null })
    h.digest.mockResolvedValue({ status: 'disabled', reason: 'flag_off' })
  })
  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  // Regresión (pendiente de F-17): la función existía pero nadie la llamaba.
  it('llama a purge_old_analytics_events y dice cuántos borró', async () => {
    const res = await call()
    expect(h.rpc).toHaveBeenCalledWith('purge_old_analytics_events')
    expect((await res.json()).analytics).toEqual({ status: 'done', deleted: 3 })
    expect(res.status).toBe(200)
  })

  it.each(['PGRST202', '42883'])('si la función aún no existe (%s), no falla', async (code) => {
    h.rpc.mockResolvedValue({ data: null, error: { code, message: 'missing' } })
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).analytics).toEqual({ status: 'not_migrated', deleted: 0 })
  })

  it('otro error de la base sí pone el cron en rojo', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } })
    expect((await call()).status).toBe(500)
  })

  it('sin claves el correo semanal queda desactivado y lo dice, sin fallar', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).weekly).toEqual({ status: 'disabled', reason: 'flag_off' })
  })

  it('un error inesperado del correo se registra y el cron sale en rojo', async () => {
    h.digest.mockRejectedValue(new Error('x'))
    const res = await call()
    expect(res.status).toBe(500)
    expect((await res.json()).weekly).toEqual({ status: 'error' })
  })

  it('sin el secreto no se ejecuta ni la retención ni el correo', async () => {
    delete process.env.CRON_SECRET
    await call()
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.digest).not.toHaveBeenCalled()
  })

  it('60 s de margen (Hobby)', () => {
    expect(maxDuration).toBe(60)
  })
})
