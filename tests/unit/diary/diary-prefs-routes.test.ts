// ============================================================
// F-24 · GET/DELETE /api/library/diary y PUT /api/library/prefs
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const mockUpdateUser = vi.fn()
const calls: Array<{ op: string; args: unknown[] }> = []
let selectResult: { data: unknown; error: unknown } = { data: [], error: null }
let deleteResult: { error: unknown; count: number | null } = { error: null, count: 1 }

function chain() {
  const c: Record<string, (...a: unknown[]) => unknown> = {}
  for (const op of ['select', 'eq', 'order']) {
    c[op] = (...args: unknown[]) => {
      calls.push({ op, args })
      return c
    }
  }
  c.limit = (...args: unknown[]) => {
    calls.push({ op: 'limit', args })
    return Promise.resolve(selectResult)
  }
  c.delete = (...args: unknown[]) => {
    calls.push({ op: 'delete', args })
    return { match: (m: unknown) => (calls.push({ op: 'match', args: [m] }), Promise.resolve(deleteResult)) }
  }
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser, updateUser: mockUpdateUser },
    from: (table: string) => {
      calls.push({ op: 'from', args: [table] })
      return chain()
    },
  }),
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

const USER = { id: '00000000-0000-4000-8000-000000000001', user_metadata: { rating_scale: 'ten' }, app_metadata: {} }
const LOG_ROW = {
  id: '11111111-1111-4111-8111-111111111111', user_id: USER.id, media_id: 'movie_550', watched_on: '2026-10-20',
  rewatch: false, rating10: '7.5', review: null, spoiler: false, private_note: 'nota', created_at: 'c', updated_at: 'u',
}

beforeEach(() => {
  calls.length = 0
  selectResult = { data: [LOG_ROW], error: null }
  deleteResult = { error: null, count: 1 }
  mockGetUser.mockResolvedValue({ data: { user: USER }, error: null })
  mockUpdateUser.mockReset()
  mockUpdateUser.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())

const get = (qs = '?mediaId=movie_550') => new Request(`http://localhost/api/library/diary${qs}`)

describe('GET /api/library/diary', () => {
  it('sin sesión → 401', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/library/diary/route')
    expect((await GET(get())).status).toBe(401)
  })

  it('sin la bandera: desactivado, con la preferencia, y sin tocar la base', async () => {
    const { GET } = await import('@/app/api/library/diary/route')
    const res = await GET(get())
    expect(await res.json()).toEqual({ enabled: false, scale: 'ten', logs: [] })
    expect(calls.find((c) => c.op === 'from')).toBeUndefined()
    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('con la bandera: los apuntes del título, del más reciente al más antiguo', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    const { GET } = await import('@/app/api/library/diary/route')
    const body = await (await GET(get())).json()
    expect(body.enabled).toBe(true)
    expect(body.logs).toEqual([
      expect.objectContaining({ id: LOG_ROW.id, rating10: 7.5, privateNote: 'nota', watchedOn: '2026-10-20' }),
    ])
    expect(calls).toContainEqual({ op: 'from', args: ['user_media_logs'] })
    expect(calls).toContainEqual({ op: 'eq', args: ['user_id', USER.id] })
    expect(calls).toContainEqual({ op: 'eq', args: ['media_id', 'movie_550'] })
    expect(calls).toContainEqual({ op: 'order', args: ['watched_on', { ascending: false }] })
  })

  it('con la bandera pero sin la tabla (42P01) → desactivado, no 500', async () => {
    vi.stubEnv('RATING_SCALE_10', '1')
    selectResult = { data: null, error: { code: '42P01', message: 'relation does not exist' } }
    const { GET } = await import('@/app/api/library/diary/route')
    const res = await GET(get())
    expect(res.status).toBe(200)
    expect((await res.json()).enabled).toBe(false)
  })

  it('mediaId con formato malo → 400', async () => {
    const { GET } = await import('@/app/api/library/diary/route')
    expect((await GET(get('?mediaId=../x'))).status).toBe(400)
  })
})

describe('DELETE /api/library/diary', () => {
  const del = (body: unknown) =>
    new Request('http://localhost/api/library/diary', { method: 'DELETE', body: JSON.stringify(body) })

  it('borra solo un apunte propio (id + user_id)', async () => {
    const { DELETE } = await import('@/app/api/library/diary/route')
    const res = await DELETE(del({ id: LOG_ROW.id }))
    expect(res.status).toBe(200)
    expect(calls).toContainEqual({ op: 'match', args: [{ id: LOG_ROW.id, user_id: USER.id }] })
  })

  it('ajeno o inexistente → 404; id que no es uuid → 400', async () => {
    const { DELETE } = await import('@/app/api/library/diary/route')
    deleteResult = { error: null, count: 0 }
    expect((await DELETE(del({ id: LOG_ROW.id }))).status).toBe(404)
    expect((await DELETE(del({ id: 'x' }))).status).toBe(400)
  })
})

describe('PUT /api/library/prefs', () => {
  const put = (body: unknown) =>
    new Request('http://localhost/api/library/prefs', { method: 'PUT', body: JSON.stringify(body) })

  it('guarda la preferencia en user_metadata', async () => {
    const { PUT } = await import('@/app/api/library/prefs/route')
    const res = await PUT(put({ ratingScale: 'stars' }))
    expect(res.status).toBe(200)
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { rating_scale: 'stars' } })
  })

  it('valor raro → 400; demo → 403; sin sesión → 401', async () => {
    const { PUT } = await import('@/app/api/library/prefs/route')
    expect((await PUT(put({ ratingScale: '100' }))).status).toBe(400)
    mockGetUser.mockResolvedValueOnce({ data: { user: { ...USER, app_metadata: { demo: true } } }, error: null })
    expect((await PUT(put({ ratingScale: 'ten' }))).status).toBe(403)
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await PUT(put({ ratingScale: 'ten' }))).status).toBe(401)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
