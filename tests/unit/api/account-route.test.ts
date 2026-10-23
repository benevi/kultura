// ============================================================
// KULTURA — Route Handler /api/account unit tests (D2 + ROJO-7)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetUser = vi.fn()
const mockUserFrom = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockUserFrom }),
}))

const mockDeleteUser = vi.fn()
const mockRpc = vi.fn()
const mockAdminFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
    rpc: mockRpc,
    from: mockAdminFrom,
  }),
}))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

const AUTH_USER = { id: 'user-001' }

/** Cadena de PostgREST que resuelve a `result` en cualquier punto final. */
function chain(result: Record<string, unknown>) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'or', 'not', 'lte', 'order', 'limit', 'update', 'upsert']) {
    c[m] = vi.fn(() => c)
  }
  c.maybeSingle = vi.fn(async () => result)
  c.then = (resolve: (v: unknown) => void) => resolve(result)
  return c
}

describe('DELETE /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ACCOUNT_GRACE
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    mockRpc.mockResolvedValue({ data: { groups: 1, lists: 0 }, error: null })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(401)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('la demo no borra nada (el admin no la frenaría)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { ...AUTH_USER, app_metadata: { demo: true } } }, error: null })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(429)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  // ROJO-7: el grupo y las listas colaborativas pasan a otra persona ANTES
  // del borrado en cascada.
  it('traspasa lo compartido y después borra al usuario', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })

    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()

    expect(mockRpc).toHaveBeenCalledWith('transfer_owned_content', { p_user: AUTH_USER.id })
    expect(mockDeleteUser).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteUser.mock.invocationCallOrder[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, scheduled: false, transferred: { groups: 1, lists: 0 } })
  })

  it('sin la migración (función inexistente) borra como siempre', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    mockDeleteUser.mockResolvedValue({ error: null })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(mockDeleteUser).toHaveBeenCalledWith(AUTH_USER.id)
  })

  it('si el traspaso falla de verdad, NO borra (mejor eso que destruir lo de otros)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'boom' } })
    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(500)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 500 if the admin delete fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockDeleteUser.mockResolvedValue({ error: { message: 'boom' } })

    const { DELETE } = await import('@/app/api/account/route')
    const res = await DELETE()
    expect(res.status).toBe(500)
  })

  describe('con ACCOUNT_GRACE=1', () => {
    beforeEach(() => {
      process.env.ACCOUNT_GRACE = '1'
    })
    afterEach(() => {
      delete process.env.ACCOUNT_GRACE
    })

    it('programa el borrado a 7 días y no borra nada todavía', async () => {
      mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
      const state = chain({ error: null })
      mockAdminFrom.mockReturnValue(state)

      const { DELETE } = await import('@/app/api/account/route')
      const res = await DELETE()
      const body = await res.json()

      expect(mockAdminFrom).toHaveBeenCalledWith('account_state')
      expect(state.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: AUTH_USER.id, deletion_requested_at: expect.any(String) }),
        { onConflict: 'user_id' }
      )
      expect(mockDeleteUser).not.toHaveBeenCalled()
      expect(body.scheduled).toBe(true)
      const days = (Date.parse(body.purgeAt) - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(6.9)
      expect(days).toBeLessThan(7.1)
    })

    it('sin la tabla (migración sin aplicar) borra ya en vez de prometer un borrado que nadie haría', async () => {
      mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
      mockAdminFrom.mockReturnValue(chain({ error: { code: '42P01', message: 'missing' } }))
      mockDeleteUser.mockResolvedValue({ error: null })
      const { DELETE } = await import('@/app/api/account/route')
      const res = await DELETE()
      expect((await res.json()).scheduled).toBe(false)
      expect(mockDeleteUser).toHaveBeenCalledWith(AUTH_USER.id)
    })
  })
})

describe('GET /api/account (resumen del modal)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ACCOUNT_GRACE
  })

  it('cuenta lo que se borra y dice a quién pasa cada grupo y lista', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const counts: Record<string, number> = { user_media: 34, lists: 3, messages: 120, friendships: 5 }
    mockAdminFrom.mockImplementation((table: string) => chain({ count: counts[table], error: null }))
    mockUserFrom.mockReturnValue(chain({ data: { deletion_requested_at: null }, error: null }))
    mockRpc.mockResolvedValue({
      data: { groups: [{ name: 'Club', successor: 'lucia_lee' }], lists: [{ name: 'Pelis', successor: 'marcos' }] },
      error: null,
    })

    const { GET } = await import('@/app/api/account/route')
    const res = await GET()
    const body = await res.json()

    expect(mockRpc).toHaveBeenCalledWith('deletion_preview', { p_user: AUTH_USER.id })
    expect(body).toMatchObject({
      library: 34,
      lists: 3,
      messages: 120,
      friends: 5,
      groups: [{ name: 'Club', successor: 'lucia_lee' }],
      sharedLists: [{ name: 'Pelis', successor: 'marcos' }],
      graceDays: 0,
    })
  })

  it('sin la migración: recuentos sí, herederos null y sin días de gracia', async () => {
    process.env.ACCOUNT_GRACE = '1'
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockAdminFrom.mockImplementation(() => chain({ count: 2, error: null }))
    mockUserFrom.mockReturnValue(chain({ data: null, error: { code: 'PGRST205', message: 'missing' } }))
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } })

    const { GET } = await import('@/app/api/account/route')
    const body = await (await GET()).json()
    expect(body.groups).toBeNull()
    expect(body.graceDays).toBe(0)
    delete process.env.ACCOUNT_GRACE
  })
})

describe('PATCH /api/account (cancelar el borrado)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('quita deletion_requested_at', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const state = chain({ error: null })
    mockAdminFrom.mockReturnValue(state)
    const { PATCH } = await import('@/app/api/account/route')
    const res = await PATCH(
      new Request('http://localhost/api/account', { method: 'PATCH', body: JSON.stringify({ cancel_deletion: true }) })
    )
    expect(res.status).toBe(200)
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ deletion_requested_at: null }))
    expect(state.eq).toHaveBeenCalledWith('user_id', AUTH_USER.id)
  })

  it('400 sin el cuerpo esperado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { PATCH } = await import('@/app/api/account/route')
    const res = await PATCH(new Request('http://localhost/api/account', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
