// MOV-3 / D-12: `appinstalled` → POST /api/pwa/installed → track('app_installed'),
// una vez por usuario, solo desde la propia web y con propiedades acotadas.
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ANALYTICS_EVENTS } from '@/lib/analytics/track'

const h = vi.hoisted(() => ({
  track: vi.fn(),
  getUser: vi.fn(),
  allowed: true,
}))

vi.mock('@/lib/analytics/track', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics/track')>()),
  track: h.track,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: h.allowed, retryAfterSeconds: 60, remaining: 0 }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: h.getUser } }),
}))

import { POST } from '@/app/api/pwa/installed/route'

const URL_ = 'https://kulturaapp.vercel.app/api/pwa/installed'
const beacon = (body: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })

beforeEach(() => {
  vi.clearAllMocks()
  h.allowed = true
  h.track.mockResolvedValue(true)
  h.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('POST /api/pwa/installed', () => {
  it('el evento está en el catálogo cerrado de track()', () => {
    expect(ANALYTICS_EVENTS).toContain('app_installed')
  })

  it('registra app_installed una vez por usuario (dedupeKey) y responde 204', async () => {
    const res = await POST(beacon(JSON.stringify({ platform: 'android', source: 'banner' })))
    expect(res.status).toBe(204)
    expect(h.track).toHaveBeenCalledWith(
      { id: 'u1' },
      'app_installed',
      { platform: 'android', source: 'banner' },
      { dedupeKey: 'app_installed:u1' },
    )
  })

  it('propiedades fuera de la lista o cuerpo roto → valores por defecto, sin texto libre', async () => {
    await POST(beacon(JSON.stringify({ platform: '<script>', source: 'x'.repeat(50) })))
    expect(h.track.mock.calls[0][2]).toEqual({ platform: 'unknown', source: 'browser' })
    await POST(beacon('{roto'))
    expect(h.track.mock.calls[1][2]).toEqual({ platform: 'unknown', source: 'browser' })
    await POST(beacon('x'.repeat(5000)))
    expect(h.track.mock.calls[2][2]).toEqual({ platform: 'unknown', source: 'browser' })
  })

  it('desde otra web (beacon cruzado) → 403 sin registrar', async () => {
    const res = await POST(beacon('{}', { 'sec-fetch-site': 'cross-site' }))
    expect(res.status).toBe(403)
    const res2 = await POST(beacon('{}', { origin: 'https://evil.example' }))
    expect(res2.status).toBe(403)
    expect(h.track).not.toHaveBeenCalled()
  })

  it('sin Sec-Fetch-Site vale el Origin propio', async () => {
    const res = await POST(beacon('{}', { origin: 'https://kulturaapp.vercel.app' }))
    expect(res.status).toBe(204)
  })

  it('sin sesión → 401; en bucle → 429; ninguno registra', async () => {
    h.getUser.mockResolvedValueOnce({ data: { user: null } })
    expect((await POST(beacon('{}'))).status).toBe(401)
    h.allowed = false
    expect((await POST(beacon('{}'))).status).toBe(429)
    expect(h.track).not.toHaveBeenCalled()
  })
})
