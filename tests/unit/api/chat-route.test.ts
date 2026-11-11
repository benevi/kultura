// ============================================================
// KULTURA — /api/chat unit tests
// POST: verifica que el handler delega creación de conversación a la
// RPC create_conversation_with_members en lugar de INSERTs directos.
// GET /api/chat/unread (E96, antes ?countOnly=1): no leídas en UNA query.
// GET /api/chat: la lista, también en UNA query (saneamiento 6.4, sin N+1).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatCreateResultSchema, conversationsResultSchema, unreadResultSchema } from '@/lib/api/contracts/chat'

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

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
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
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
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
    await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(mockRpc).toHaveBeenCalledWith('create_conversation_with_members', {
      target_user_id: '00000000-0000-4000-8000-00000000000b',
    })
  })

  it('returns conversationId from RPC on success', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-uuid-123', error: null })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(chatCreateResultSchema.parse(body.data).conversationId).toBe('conv-uuid-123')
  })

  it('returns 500 when RPC returns error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: '42501', code: 'P0001' } })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(res.status).toBe(500)
  })

  it('returns 403 when RPC signals not_friends (by message)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_friends', code: 'P0005' } })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'forbidden', message: 'not_friends' })
  })

  it('returns 403 when RPC signals not_friends (by code, message masked)', async () => {
    // Supabase a veces enmascara el mensaje del RAISE; el code P0005 debe bastar.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'internal error', code: 'P0005' } })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(res.status).toBe(403)
  })

  it('returns existing conversation between ex-friends (dedupe path, still 201)', async () => {
    // El RPC hace dedupe ANTES del check de amistad: una conversación previa
    // sigue devolviéndose aunque ya no sean amigos. Desde el endpoint esto es
    // indistinguible de un éxito normal: data con id, sin error.
    mockRpc.mockResolvedValue({ data: 'existing-conv-uuid', error: null })
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000e' }) as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.conversationId).toBe('existing-conv-uuid')
  })

  it('does NOT call supabase.from (no direct table inserts)', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-uuid-456', error: null })
    const { POST } = await import('@/app/api/chat/route')
    await POST(makeRequest({ targetUserId: '00000000-0000-4000-8000-00000000000b' }) as never)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ============================================================
// E96 — GET /api/chat/unread
// ============================================================

const mockSelect = vi.fn()
const mockEq = vi.fn()

function stubCountQuery(rows: unknown, error: unknown = null) {
  mockEq.mockResolvedValue({ data: rows, error })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

function convRow(opts: { lastReadAt: string | null; lastMessageAt: string; msgCount: number }) {
  return {
    last_read_at: opts.lastReadAt,
    conversations: {
      last_message_at: opts.lastMessageAt,
      messages: [{ count: opts.msgCount }],
    },
  }
}

describe('GET /api/chat/unread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('counts conversation never opened (last_read_at null) with messages', async () => {
    stubCountQuery([convRow({ lastReadAt: null, lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 5 })])
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(unreadResultSchema.parse((await res.json()).data).count).toBe(1)
  })

  it('counts conversation with message newer than last_read_at', async () => {
    stubCountQuery([
      convRow({ lastReadAt: '2026-07-16T09:00:00Z', lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 2 }),
    ])
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(unreadResultSchema.parse((await res.json()).data).count).toBe(1)
  })

  it('does NOT count conversation already read (last_read_at >= last_message_at)', async () => {
    stubCountQuery([
      convRow({ lastReadAt: '2026-07-16T11:00:00Z', lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 2 }),
    ])
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(unreadResultSchema.parse((await res.json()).data).count).toBe(0)
  })

  it('REGRESIÓN: conversación vacía (0 mensajes, nunca abierta) no cuenta', async () => {
    // Al crearse una conversación last_message_at = now() por default y
    // last_read_at es null → sin el filtro por count de mensajes el badge
    // mostraría un no-leído fantasma sin nada que leer.
    stubCountQuery([convRow({ lastReadAt: null, lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 0 })])
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(unreadResultSchema.parse((await res.json()).data).count).toBe(0)
  })

  it('aggregates mixed rows correctly', async () => {
    stubCountQuery([
      convRow({ lastReadAt: null, lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 3 }), // unread
      convRow({ lastReadAt: '2026-07-16T09:00:00Z', lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 1 }), // unread
      convRow({ lastReadAt: '2026-07-16T11:00:00Z', lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 4 }), // read
      convRow({ lastReadAt: null, lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 0 }), // empty
    ])
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(unreadResultSchema.parse((await res.json()).data).count).toBe(2)
  })

  it('runs ONE query: single from() call with joined select (no N+1)', async () => {
    stubCountQuery([convRow({ lastReadAt: null, lastMessageAt: '2026-07-16T10:00:00Z', msgCount: 3 })])
    const { GET } = await import('@/app/api/chat/unread/route')
    await GET()
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('conversation_members')
    expect(mockSelect.mock.calls[0][0]).toContain('conversations!inner')
    expect(mockSelect.mock.calls[0][0]).toContain('messages(count)')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-a')
  })

  it('returns 500 when the query fails', async () => {
    stubCountQuery(null, { message: 'boom' })
    const { GET } = await import('@/app/api/chat/unread/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ============================================================
// Saneamiento 6.4 — GET /api/chat sin N+1
// ============================================================

describe('GET /api/chat', () => {
  /** Cadena select().eq().neq().order().order().limit().limit() que resuelve al final. */
  function stubListQuery(rows: unknown, error: unknown = null) {
    const calls: Array<[string, unknown[]]> = []
    const chain: Record<string, unknown> = {}
    let limits = 0
    for (const m of ['select', 'eq', 'neq', 'order']) {
      chain[m] = (...a: unknown[]) => {
        calls.push([m, a])
        return chain
      }
    }
    chain.limit = (...a: unknown[]) => {
      calls.push(['limit', a])
      return ++limits === 2 ? Promise.resolve({ data: rows, error }) : chain
    }
    mockFrom.mockReturnValue(chain)
    return calls
  }

  const BEA = { id: 'user-b', username: 'bea', avatar_color: '#fff', avatar_initials: 'B' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  })

  it('una sola consulta con el otro miembro y el último mensaje embebidos', async () => {
    const calls = stubListQuery([
      {
        conversation_id: 'c1',
        last_read_at: '2026-07-16T09:00:00Z',
        conversations: {
          id: 'c1',
          last_message_at: '2026-07-16T10:00:00Z',
          messages: [{ content: 'hola', sender_id: 'user-b', created_at: '2026-07-16T10:00:00Z' }],
          others: [{ users: BEA }],
        },
      },
      {
        conversation_id: 'c2',
        last_read_at: null,
        conversations: { id: 'c2', last_message_at: '2026-07-15T10:00:00Z', messages: [], others: [] },
      },
    ])
    const { GET } = await import('@/app/api/chat/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = conversationsResultSchema.parse((await res.json()).data)
    expect(data).toEqual([
      { id: 'c1', lastMessageAt: '2026-07-16T10:00:00Z', otherUser: BEA, lastMessage: { content: 'hola', isMine: false }, unread: true },
      { id: 'c2', lastMessageAt: '2026-07-15T10:00:00Z', otherUser: null, lastMessage: null, unread: false },
    ])
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('conversation_members')
    expect(calls).toContainEqual(['neq', ['conversations.others.user_id', 'user-a']])
    expect(calls).toContainEqual(['limit', [1, { referencedTable: 'conversations.messages' }]])
  })

  it('mensaje mío y ya leído: isMine y sin no leídas', async () => {
    stubListQuery([
      {
        conversation_id: 'c1',
        last_read_at: '2026-07-16T11:00:00Z',
        conversations: {
          id: 'c1',
          last_message_at: '2026-07-16T10:00:00Z',
          messages: [{ content: 'yo', sender_id: 'user-a', created_at: '2026-07-16T10:00:00Z' }],
          others: [{ users: BEA }],
        },
      },
    ])
    const { GET } = await import('@/app/api/chat/route')
    const data = conversationsResultSchema.parse((await (await GET()).json()).data)
    expect(data[0]).toMatchObject({ lastMessage: { content: 'yo', isMine: true }, unread: false })
  })

  it('500 si falla la consulta', async () => {
    stubListQuery(null, { code: 'XX000', message: 'boom' })
    const { GET } = await import('@/app/api/chat/route')
    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('internal')
  })
})
