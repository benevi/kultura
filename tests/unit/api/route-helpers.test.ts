// ============================================================
// KULTURA — Helpers de los Route Handlers y contrato de errores (6.2 y 7.1)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const mockGetUser = vi.fn()
const mockRateLimit = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitDistributed: async (...a: unknown[]) => mockRateLimit(...a),
}))

import { apiError, ok, parseBody, parseQuery, rateLimit, requireUser } from '@/lib/api/route'
import { mediaIdSchema } from '@/lib/api/contracts/common'
import { ApiError, apiFetch, toApiError } from '@/lib/api/client'

const LIMIT = { windowMs: 60_000, max: 5 }

function post(body: unknown, raw = false): Request {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
})

describe('ok y apiError', () => {
  it('ok envuelve en { data }', async () => {
    const res = ok({ a: 1 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { a: 1 } })
  })

  it('apiError usa el estado del catálogo y solo los campos que llegan', async () => {
    const res = apiError('not_found')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'not_found' } })

    const withField = apiError('invalid_input', { field: 'status', message: 'bad' })
    expect(withField.status).toBe(400)
    expect(await withField.json()).toEqual({ error: { code: 'invalid_input', field: 'status', message: 'bad' } })
  })
})

describe('requireUser', () => {
  it('401 unauthenticated sin sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const auth = await requireUser()
    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.response.status).toBe(401)
      expect(await auth.response.json()).toEqual({ error: { code: 'unauthenticated' } })
    }
  })

  it('devuelve el usuario y el cliente', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const auth = await requireUser()
    expect(auth.ok && auth.user.id).toBe('u1')
  })
})

describe('rateLimit', () => {
  it('por usuario si hay sesión', async () => {
    expect(await rateLimit(post({}), { key: 'library', limit: LIMIT, userId: 'u1' })).toBeNull()
    expect(mockRateLimit).toHaveBeenCalledWith('library:u1', LIMIT)
  })

  it('por la primera IP de x-forwarded-for si no', async () => {
    await rateLimit(post({}), { key: 'search', limit: LIMIT })
    expect(mockRateLimit).toHaveBeenCalledWith('search:ip:203.0.113.7', LIMIT)
  })

  it('429 rate_limited con Retry-After', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 })
    const res = await rateLimit(post({}), { key: 'library', limit: LIMIT, userId: 'u1' })
    expect(res?.status).toBe(429)
    expect(res?.headers.get('Retry-After')).toBe('12')
    expect(await res?.json()).toEqual({ error: { code: 'rate_limited' } })
  })
})

describe('parseBody y parseQuery', () => {
  const schema = z.object({ mediaId: mediaIdSchema, n: z.number().int().optional() })

  it('invalid_json si el cuerpo no es JSON', async () => {
    const r = await parseBody(post('{', true), schema)
    expect(!r.ok && (await r.response.json())).toEqual({ error: { code: 'invalid_json' } })
  })

  it('invalid_input con el campo que falla', async () => {
    const r = await parseBody(post({ mediaId: 'sin-formato' }), schema)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const body = await r.response.json()
      expect(r.response.status).toBe(400)
      expect(body.error.code).toBe('invalid_input')
      expect(body.error.field).toBe('mediaId')
    }
  })

  it('devuelve el valor validado', async () => {
    const r = await parseBody(post({ mediaId: 'movie_603', n: 2 }), schema)
    expect(r.ok && r.value).toEqual({ mediaId: 'movie_603', n: 2 })
  })

  it('parseQuery lee el primer valor de cada clave', () => {
    const q = z.object({ mediaId: mediaIdSchema })
    const good = parseQuery(new Request('http://localhost/api/x?mediaId=tv_1&mediaId=tv_2'), q)
    expect(good.ok && good.value).toEqual({ mediaId: 'tv_1' })
    expect(parseQuery(new Request('http://localhost/api/x'), q).ok).toBe(false)
  })
})

describe('mediaIdSchema', () => {
  it.each(['movie_603', 'book_ol_OL123W', 'game_3498'])('acepta %s', (id) => {
    expect(mediaIdSchema.safeParse(id).success).toBe(true)
  })
  it.each(['', '603', 'Movie_603', 'movie_', 'm'.repeat(201) + '_1'])('rechaza %j', (id) => {
    expect(mediaIdSchema.safeParse(id).success).toBe(false)
  })
})

describe('apiFetch', () => {
  it('devuelve data y manda el cuerpo como JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await apiFetch('/api/x', { method: 'POST', json: { a: 1 } })).toEqual({ id: 1 })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe('{"a":1}')
    expect(init.headers['Content-Type']).toBe('application/json')
    vi.unstubAllGlobals()
  })

  it('lanza ApiError con el code, el campo y Retry-After', async () => {
    const res = new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
      status: 429,
      headers: { 'Retry-After': '7' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
    const err = (await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('rate_limited')
    expect(err.retryAfter).toBe(7)
    vi.unstubAllGlobals()
  })

  it('un fallo de red sale como internal con estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = (await apiFetch('/api/x').catch((e: unknown) => e)) as ApiError
    expect(err.code).toBe('internal')
    expect(err.status).toBe(0)
    vi.unstubAllGlobals()
  })

  it('sin code del catálogo, lo saca del estado', async () => {
    expect((await toApiError(new Response('nope', { status: 502 }))).code).toBe('provider_unavailable')
    expect((await toApiError(new Response(JSON.stringify({ error: 'x' }), { status: 404 }))).code).toBe('not_found')
  })
})
