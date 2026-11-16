// /api/suggestions con el contrato { data } / { error } (saneamiento 9).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, insert, limit } = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser }, from: () => ({ insert }) }),
}))
vi.mock('@/lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: limit,
}))

import { POST } from '@/app/api/suggestions/route'

const valid = { type: 'bug', subject: 'Algo falla', description: 'Una descripción larga.' }
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/suggestions', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    insert.mockResolvedValue({ error: null })
    limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0, remaining: 2 })
  })

  it('guarda la sugerencia y responde { data: null }', async () => {
    const res = await post(valid)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', ...valid })
  })

  it('sin sesión → 401 unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await post(valid)
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('unauthenticated')
    expect(insert).not.toHaveBeenCalled()
  })

  it('datos no válidos → 400 invalid_input con el campo', async () => {
    const res = await post({ ...valid, subject: 'ab' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_input', field: 'subject' } })
  })

  it('pasado el cupo → 429 rate_limited con Retry-After', async () => {
    limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120, remaining: 0 })
    const res = await post(valid)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect((await res.json()).error.code).toBe('rate_limited')
  })

  it('si la base falla → 500 internal', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } })
    const res = await post(valid)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('internal')
  })
})
