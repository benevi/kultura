// ============================================================
// KULTURA — Route Handler /api/lists/[id] unit tests (DELETE item)
// Verifica el borrado de item: 404 si no existe, 403 sin permiso, 200 OK.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'DELETE'): Request {
  return new Request('http://localhost/api/lists/list-001', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PARAMS = { params: Promise.resolve({ id: 'list-001' }) }

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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  LIMITS: { lists: {} },
}))

const mockCanEditList = vi.fn()
vi.mock('@/lib/social/lists', () => ({
  canEditList: (...args: unknown[]) => mockCanEditList(...args),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DELETE /api/lists/[id] — eliminar item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve 401 si el usuario no está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } })

    const { DELETE } = await import('@/app/api/lists/[id]/route')
    const response = await DELETE(makeRequest({ itemId: 'item-001' }), PARAMS)

    expect(response.status).toBe(401)
  })

  it('devuelve 400 si falta itemId', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })

    const { DELETE } = await import('@/app/api/lists/[id]/route')
    const response = await DELETE(makeRequest({}), PARAMS)

    expect(response.status).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('itemId is required')
  })

  it('devuelve 403 si el usuario no puede editar la lista', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(false)

    const { DELETE } = await import('@/app/api/lists/[id]/route')
    const response = await DELETE(makeRequest({ itemId: 'item-001' }), PARAMS)

    expect(response.status).toBe(403)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Forbidden')
  })

  it('devuelve 404 si el item no existía', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(true)
    mockListItemsDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null, count: 0 }),
      }),
    })

    const { DELETE } = await import('@/app/api/lists/[id]/route')
    const response = await DELETE(makeRequest({ itemId: 'item-999' }), PARAMS)

    expect(response.status).toBe(404)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Not found')
  })

  it('devuelve 200 { ok: true } al eliminar correctamente', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-001' } }, error: null })
    mockCanEditList.mockResolvedValueOnce(true)
    mockListItemsDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null, count: 1 }),
      }),
    })

    const { DELETE } = await import('@/app/api/lists/[id]/route')
    const response = await DELETE(makeRequest({ itemId: 'item-001' }), PARAMS)

    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})
