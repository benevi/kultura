// ============================================================
// KULTURA — PUT /api/settings/platforms (saneamiento 9.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { platformsPutResultSchema } from '@/lib/api/contracts/settings'

const USER = { id: 'user-001', email: 'test@example.com', app_metadata: {}, user_metadata: {} }

const mockGetUser = vi.fn()
const upserts: Array<{ table: string; values: Record<string, unknown>; opts: unknown }> = []
let upsertResult: { data: unknown; error: unknown } = { data: [{ user_id: USER.id }], error: null }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => ({
      upsert: (values: Record<string, unknown>, opts: unknown) => {
        upserts.push({ table, values, opts })
        return { select: async () => upsertResult }
      },
    }),
  }),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

async function put(body: unknown) {
  const { PUT } = await import('@/app/api/settings/platforms/route')
  const res = await PUT(
    new Request('http://localhost/api/settings/platforms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  upserts.length = 0
  upsertResult = { data: [{ user_id: USER.id }], error: null }
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
})

describe('PUT /api/settings/platforms', () => {
  it('401 sin sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await put({ services: [8], region: 'ES' })).status).toBe(401)
    expect(upserts).toHaveLength(0)
  })

  it('guarda en la tabla privada con el id de la sesión, sin repetidos', async () => {
    const { status, json } = await put({ services: [8, 63, 8], region: 'ES' })
    expect(status).toBe(200)
    expect(platformsPutResultSchema.parse(json.data)).toBeNull()
    expect(upserts).toHaveLength(1)
    expect(upserts[0].table).toBe('user_streaming_services')
    expect(upserts[0].values).toMatchObject({ user_id: USER.id, services: [8, 63], region: 'ES' })
    expect(upserts[0].opts).toEqual({ onConflict: 'user_id' })
  })

  it('ignora un user_id en el cuerpo', async () => {
    await put({ services: [8], region: 'US', user_id: 'otro' })
    expect(upserts[0].values.user_id).toBe(USER.id)
  })

  it('400 con región desconocida, ids no válidos o más de 30', async () => {
    expect((await put({ services: [8], region: 'FR' })).status).toBe(400)
    expect((await put({ services: [-1], region: 'ES' })).status).toBe(400)
    expect((await put({ services: ['8'], region: 'ES' })).status).toBe(400)
    expect((await put({ services: Array.from({ length: 31 }, (_, i) => i + 1), region: 'ES' })).status).toBe(400)
    expect(upserts).toHaveLength(0)
  })

  it('demo: 403 y no escribe', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...USER, email: 'demo@kultura.app', app_metadata: { demo: true } } },
      error: null,
    })
    expect((await put({ services: [8], region: 'ES' })).status).toBe(403)
    expect(upserts).toHaveLength(0)
  })

  it('0 filas (la RLS no dejó) o error: 500', async () => {
    upsertResult = { data: [], error: null }
    expect((await put({ services: [8], region: 'ES' })).status).toBe(500)
    upsertResult = { data: null, error: { message: 'x' } }
    expect((await put({ services: [8], region: 'ES' })).status).toBe(500)
  })
})
