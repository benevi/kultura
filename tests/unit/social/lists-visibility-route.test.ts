// ============================================================
// KULTURA — PATCH /api/lists/[id] (publicar / despublicar) unit tests
// Publicar es del DUEÑO: un miembro de una colaborativa puede editar títulos
// pero no exponer la lista a todo el mundo.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const PARAMS = { params: Promise.resolve({ id: 'list-001' }) }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/lists/list-001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const mockGetUser = vi.fn()
const mockListLookup = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== 'lists') return {}
      return {
        select: () => ({ eq: () => ({ maybeSingle: mockListLookup }) }),
        update: (values: unknown) => {
          mockUpdate(values)
          return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }
        },
      }
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  LIMITS: { lists: {} },
}))
vi.mock('@/lib/social/lists', () => ({ canEditList: vi.fn() }))

describe('PATCH /api/lists/[id] — visibilidad', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 sin sesión', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'no' } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    expect((await PATCH(makeRequest({ isPublic: true }), PARAMS)).status).toBe(401)
  })

  it('400 si isPublic no es booleano', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'owner' } }, error: null })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    expect((await PATCH(makeRequest({ isPublic: 'yes' }), PARAMS)).status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('404 si la lista no existe (o no es legible)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'owner' } }, error: null })
    mockListLookup.mockResolvedValueOnce({ data: null })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    expect((await PATCH(makeRequest({ isPublic: true }), PARAMS)).status).toBe(404)
  })

  it('403 si no es el dueño, aunque sea miembro', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'member' } }, error: null })
    mockListLookup.mockResolvedValueOnce({ data: { owner_id: 'owner' } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    expect((await PATCH(makeRequest({ isPublic: true }), PARAMS)).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('200 y escribe is_public si es el dueño', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'owner' } }, error: null })
    mockListLookup.mockResolvedValueOnce({ data: { owner_id: 'owner' } })
    const { PATCH } = await import('@/app/api/lists/[id]/route')
    const res = await PATCH(makeRequest({ isPublic: true }), PARAMS)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ is_public: true })
    expect(await res.json()).toEqual({ ok: true, isPublic: true })
  })
})
