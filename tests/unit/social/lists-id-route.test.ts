// ============================================================
// KULTURA — Route Handler /api/lists/[id]/items unit tests (DELETE item)
// Verifica el borrado de item: 404 si no existe, 403 sin permiso, 200 OK.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'DELETE'): Request {
  return new Request('http://localhost/api/lists/11111111-1111-4111-8111-111111111111/items', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }

// ── Mock factories ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockListItemsDelete = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'list_items') {
        return { delete: mockListItemsDelete }
      }
      return {}
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))

const mockCanEditList = vi.fn()
vi.mock('@/lib/social/lists', () => ({
  getListAccess: async () => {
    const canEdit = await mockCanEditList()
    return { exists: true, canEdit, isOwner: canEdit, mediaType: 'movie' }
  },
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DELETE /api/lists/[id]/items — eliminar item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve 401 si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } })

    const { DELETE } = await import('@/app/api/lists/[id]/items/route')
    const response = await DELETE(makeRequest({ itemId: '22222222-2222-4222-8222-222222222222' }), PARAMS)

    expect(response.status).toBe(401)
  })

  it('devuelve 400 si falta itemId', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })

    const { DELETE } = await import('@/app/api/lists/[id]/items/route')
    const response = await DELETE(makeRequest({}), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json() as { error: { code: string; field?: string } }
    expect(body.error).toMatchObject({ code: 'invalid_input', field: 'itemId' })
  })

  it('devuelve 403 si el usuario no puede editar la lista', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(false)

    const { DELETE } = await import('@/app/api/lists/[id]/items/route')
    const response = await DELETE(makeRequest({ itemId: '22222222-2222-4222-8222-222222222222' }), PARAMS)

    expect(response.status).toBe(403)
    const body = await response.json() as { error: { code: string } }
    expect(body.error.code).toBe('forbidden')
  })

  it('devuelve 404 si el item no existía', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(true)
    mockListItemsDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null, count: 0 }),
      }),
    })

    const { DELETE } = await import('@/app/api/lists/[id]/items/route')
    const response = await DELETE(makeRequest({ itemId: '99999999-9999-4999-8999-999999999999' }), PARAMS)

    expect(response.status).toBe(404)
    const body = await response.json() as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('devuelve 200 { data: null } al eliminar correctamente', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(true)
    mockListItemsDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null, count: 1 }),
      }),
    })

    const { DELETE } = await import('@/app/api/lists/[id]/items/route')
    const response = await DELETE(makeRequest({ itemId: '22222222-2222-4222-8222-222222222222' }), PARAMS)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: null })
  })
})
