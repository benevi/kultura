// ============================================================
// KULTURA — POST /api/groups/[id]/posts (saneamiento 4.6)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const GROUP_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const mockGetUser = vi.fn()
const mockInsert = vi.fn()
const mockRateLimit = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ insert: mockInsert })),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitDistributed: async (...a: unknown[]) => mockRateLimit(...a),
  LIMITS: { group_posts: { windowMs: 60_000, max: 10 } },
}))

import { POST } from '@/app/api/groups/[id]/posts/route'

function req(body: unknown, raw = false): NextRequest {
  return new NextRequest(`http://localhost/api/groups/${GROUP_ID}/posts`, {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
  })
}
const ctx = { params: Promise.resolve({ id: GROUP_ID }) }

describe('POST /api/groups/[id]/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('401 sin sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await POST(req({ content: 'hola' }), ctx)).status).toBe(401)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('429 con rate limit, sin insertar', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const res = await POST(req({ content: 'hola' }), ctx)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect((await res.json()).error.code).toBe('rate_limited')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRateLimit).toHaveBeenCalledWith(`group_posts:${USER_ID}`, expect.anything())
  })

  it('400 con JSON inválido, vacío, no string o demasiado largo', async () => {
    const bad = await POST(req('{', true), ctx)
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('invalid_json')
    for (const content of ['   ', 42, 'x'.repeat(1001)]) {
      const res = await POST(req({ content }), ctx)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatchObject({ code: 'invalid_input', field: 'content' })
    }
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('404 si el id del grupo no es un uuid', async () => {
    const res = await POST(req({ content: 'hola' }), { params: Promise.resolve({ id: 'group-001' }) })
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('201: inserta con el usuario de la sesión y el texto recortado', async () => {
    const res = await POST(req({ content: '  hola  ', user_id: 'otro' }), ctx)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ data: null })
    expect(mockInsert).toHaveBeenCalledWith({ group_id: GROUP_ID, user_id: USER_ID, content: 'hola' })
  })

  it('403 si la RLS lo rechaza (no miembro o vetado)', async () => {
    mockInsert.mockResolvedValue({ error: { code: '42501' } })
    const res = await POST(req({ content: 'hola' }), ctx)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('500 con otro error', async () => {
    mockInsert.mockResolvedValue({ error: { code: 'XX000' } })
    const res = await POST(req({ content: 'hola' }), ctx)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('internal')
  })
})
