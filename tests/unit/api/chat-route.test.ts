// ============================================================
// KULTURA — /api/chat POST unit tests
// Verifica que el handler delega creación de conversación a la
// RPC create_conversation_with_members en lugar de INSERTs directos.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()

function buildSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => buildSupabaseMock(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  LIMITS: { chat_create: {} },
}))

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: 'user-b' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when targetUserId missing', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({}) as never)
    expect(res.status).toBe(400)
  })

  it('calls RPC create_conversation_with_members with correct args', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-uuid-123', error: null })
    const { POST } = await import('@/app/api/chat/route')
    await POST(makeRequest({ targetUserId: 'user-b' }) as never)
    expect(mockRpc).toHaveBeenCalledWith('create_conversation_with_members', {
      target_user_id: 'user-b',
    })
  })

  it('returns conversationId from RPC on success', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-uuid-123', error: null })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: 'user-b' }) as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.conversationId).toBe('conv-uuid-123')
  })

  it('returns 500 when RPC returns error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: '42501', code: 'P0001' } })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: 'user-b' }) as never)
    expect(res.status).toBe(500)
  })

  it('does NOT call supabase.from (no direct table inserts)', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-uuid-456', error: null })
    const { POST } = await import('@/app/api/chat/route')
    await POST(makeRequest({ targetUserId: 'user-b' }) as never)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
