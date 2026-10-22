// ============================================================
// KULTURA — Route Handler /api/account/export unit tests (D3)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb, fakeClient, type FakeDb } from '../media/fake-supabase'

// SEG-8 (art. 15/20 RGPD): el resto de datos del usuario se lee con el cliente
// admin filtrando SIEMPRE por su id (varias tablas no le dejan leer lo suyo por
// RLS: reports no tiene SELECT, y los posts de un grupo del que salió dejan de
// verse).
const { adminState } = vi.hoisted(() => ({ adminState: { db: null as unknown as FakeDb } }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(adminState.db, 'admin'),
}))

const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockProfileSingle,
        })),
      })),
    })),
  }),
}))

const mockGetUserMedia = vi.fn()
vi.mock('@/lib/library/queries', () => ({ getUserMedia: (...a: unknown[]) => mockGetUserMedia(...a) }))

const mockGetUserLists = vi.fn()
const mockGetListDetail = vi.fn()
vi.mock('@/lib/social/lists', () => ({
  getUserLists: (...a: unknown[]) => mockGetUserLists(...a),
  getListDetail: (...a: unknown[]) => mockGetListDetail(...a),
}))

const mockGetFriends = vi.fn()
vi.mock('@/lib/social/friends', () => ({ getFriends: (...a: unknown[]) => mockGetFriends(...a) }))

const mockCheckRateLimit = vi.fn<() => { allowed: boolean; retryAfterSeconds: number }>(() => ({
  allowed: true,
  retryAfterSeconds: 0,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => mockCheckRateLimit() }
})

const AUTH_USER = { id: 'user-001', email: 'user@example.com' }
const PROFILE_ROW = {
  username: 'alice',
  bio: null,
  avatar_color: '#E82020',
  avatar_icon: 'astronaut',
  avatar_initials: 'AL',
  preferred_locale: 'es',
  created_at: '2024-01-01T00:00:00Z',
}

const ME = 'user-001'
const OTHER = 'user-002'
const STRANGER = 'user-003'

function fullDb() {
  return createFakeDb({
    users: [
      { id: ME, username: 'alice' },
      { id: OTHER, username: 'bob' },
      { id: STRANGER, username: 'carol' },
    ],
    messages: [
      { id: 'm1', conversation_id: 'c1', sender_id: ME, content: 'hola', created_at: '2026-01-02' },
      { id: 'm2', conversation_id: 'c1', sender_id: OTHER, content: 'de bob', created_at: '2026-01-03' },
      { id: 'm3', conversation_id: 'c9', sender_id: STRANGER, content: 'ajeno', created_at: '2026-01-04' },
    ],
    conversation_members: [
      { conversation_id: 'c1', user_id: ME, last_read_at: '2026-01-05' },
      { conversation_id: 'c1', user_id: OTHER, last_read_at: null },
      { conversation_id: 'c9', user_id: STRANGER, last_read_at: null },
    ],
    conversations: [
      { id: 'c1', created_at: '2026-01-01', last_message_at: '2026-01-03' },
      { id: 'c9', created_at: '2026-01-01', last_message_at: '2026-01-04' },
    ],
    group_posts: [
      { id: 'p1', group_id: 'g1', user_id: ME, content: 'mi post', media_id: 'movie_550', created_at: '2026-02-01' },
      { id: 'p2', group_id: 'g1', user_id: OTHER, content: 'post de bob', media_id: null, created_at: '2026-02-02' },
    ],
    groups: [
      { id: 'g1', owner_id: OTHER, name: 'Cine', description: null, cover_color: '#000', icon: null, is_public: true, created_at: '2026-01-01' },
      { id: 'g2', owner_id: ME, name: 'Mío', description: 'x', cover_color: '#fff', icon: 'cat', is_public: false, created_at: '2026-01-02' },
      { id: 'g3', owner_id: STRANGER, name: 'Ajeno', description: null, cover_color: '#111', icon: null, is_public: true, created_at: '2026-01-03' },
    ],
    group_members: [
      { group_id: 'g1', user_id: ME, role: 'member', joined_at: '2026-01-10' },
      { group_id: 'g2', user_id: ME, role: 'owner', joined_at: '2026-01-02' },
      { group_id: 'g3', user_id: STRANGER, role: 'owner', joined_at: '2026-01-03' },
    ],
    group_invitations: [
      { id: 'i1', group_id: 'g2', inviter_id: ME, invitee_id: OTHER, status: 'pending', created_at: '2026-03-01' },
      { id: 'i2', group_id: 'g3', inviter_id: STRANGER, invitee_id: OTHER, status: 'pending', created_at: '2026-03-02' },
    ],
    recommendations: [
      { id: 'r1', from_user_id: ME, to_user_id: OTHER, media_id: 'movie_550', message: 'mírala', read_at: null, created_at: '2026-04-01' },
      { id: 'r2', from_user_id: OTHER, to_user_id: ME, media_id: 'tv_1', message: null, read_at: '2026-04-03', created_at: '2026-04-02' },
      { id: 'r3', from_user_id: OTHER, to_user_id: STRANGER, media_id: 'tv_2', message: null, read_at: null, created_at: '2026-04-02' },
    ],
    suggestions: [
      { id: 's1', user_id: ME, type: 'feature', subject: 'Modo oscuro', description: '...', created_at: '2026-05-01' },
      { id: 's2', user_id: OTHER, type: 'bug', subject: 'Ajena', description: '...', created_at: '2026-05-01' },
    ],
    notifications: [
      { id: 'n1', user_id: ME, type: 'recommendation', payload: { recommendationId: 'r2' }, read_at: null, created_at: '2026-04-02' },
      { id: 'n2', user_id: OTHER, type: 'recommendation', payload: {}, read_at: null, created_at: '2026-04-01' },
    ],
    reports: [
      { id: 'rep1', reporter_id: ME, target_type: 'media', target_id: 'movie_9', reason: 'spam', created_at: '2026-06-01' },
      { id: 'rep2', reporter_id: OTHER, target_type: 'user', target_id: ME, reason: 'x', created_at: '2026-06-02' },
    ],
  })
}

describe('GET /api/account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 })
    adminState.db = createFakeDb()
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 })
    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(429)
  })

  it('returns profile + library + lists + friendships for the authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([{ id: 'um-1' }])
    mockGetUserLists.mockResolvedValue([{ id: 'list-1' }])
    mockGetFriends.mockResolvedValue([{ friendshipId: 'f-1' }])

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.username).toBe('alice')
    expect(body.profile.email).toBe(AUTH_USER.email)
    expect(body.library).toEqual([{ id: 'um-1' }])
    // `items` se añade siempre: una lista ajena (sin owner propio) va vacía.
    expect(body.lists).toEqual([{ id: 'list-1', items: [] }])
    expect(body.friendships).toEqual([{ friendshipId: 'f-1' }])
    expect(typeof body.exportedAt).toBe('string')
    expect(mockGetUserMedia).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockGetUserLists).toHaveBeenCalledWith(AUTH_USER.id)
    expect(mockGetFriends).toHaveBeenCalledWith(AUTH_USER.id)
  })

  // Sin esto el export guardaba listas VACÍAS y reimportarlas no reconstruía
  // nada (ver /api/account/import).
  it('incluye el contenido de las listas propias', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([])
    mockGetUserLists.mockResolvedValue([
      { id: 'list-1', name: 'Pendientes', owner: { id: AUTH_USER.id } },
      { id: 'list-2', name: 'De otro', owner: { id: 'user-999' } },
    ])
    mockGetFriends.mockResolvedValue([])
    mockGetListDetail.mockResolvedValue({
      items: [{ mediaId: 'movie_550' }, { mediaId: 'game_1' }],
    })

    const { GET } = await import('@/app/api/account/export/route')
    const body = await (await GET()).json()

    expect(body.lists[0].items).toEqual(['movie_550', 'game_1'])
    // La lista ajena no se recorre: no es del usuario y no le toca recuperarla.
    expect(body.lists[1].items).toEqual([])
    expect(mockGetListDetail).toHaveBeenCalledTimes(1)
  })

  it('si falla el detalle de una lista, el export sigue adelante sin su contenido', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockResolvedValue([])
    mockGetUserLists.mockResolvedValue([
      { id: 'list-1', name: 'Pendientes', owner: { id: AUTH_USER.id } },
    ])
    mockGetFriends.mockResolvedValue([])
    mockGetListDetail.mockRejectedValue(new Error('boom'))

    const res = await (await import('@/app/api/account/export/route')).GET()

    expect(res.status).toBe(200)
    expect((await res.json()).lists[0].items).toEqual([])
  })

  it('returns 500 if the profile lookup fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 500 if any of the data queries throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockGetUserMedia.mockRejectedValue(new Error('db down'))
    mockGetUserLists.mockResolvedValue([])
    mockGetFriends.mockResolvedValue([])

    const { GET } = await import('@/app/api/account/export/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })

  describe('export completo (SEG-8)', () => {
    function arrange() {
      mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
      mockProfileSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
      mockGetUserMedia.mockResolvedValue([])
      mockGetUserLists.mockResolvedValue([])
      mockGetFriends.mockResolvedValue([])
      adminState.db = fullDb()
    }

    async function exportAll() {
      arrange()
      const res = await (await import('@/app/api/account/export/route')).GET()
      expect(res.status).toBe(200)
      return res.json()
    }

    it('incluye las 7 claves nuevas, el avatar y los metadatos de las conversaciones', async () => {
      const body = await exportAll()
      for (const key of ['messages', 'groupPosts', 'groups', 'recommendations', 'suggestions', 'notifications', 'reports']) {
        expect(body, key).toHaveProperty(key)
      }
      expect(body.profile.avatar_icon).toBe('astronaut')
      expect(body).toHaveProperty('conversations')
      expect(body).toHaveProperty('groupInvitations')
    })

    it('solo trae lo PROPIO: mensajes enviados, posts, sugerencias, avisos y denuncias del usuario', async () => {
      const body = await exportAll()
      expect(body.messages).toEqual([{ id: 'm1', conversationId: 'c1', content: 'hola', createdAt: '2026-01-02' }])
      expect(body.groupPosts).toEqual([
        { id: 'p1', groupId: 'g1', content: 'mi post', mediaId: 'movie_550', createdAt: '2026-02-01' },
      ])
      expect(body.suggestions.map((s: { id: string }) => s.id)).toEqual(['s1'])
      expect(body.notifications.map((n: { id: string }) => n.id)).toEqual(['n1'])
      expect(body.reports).toEqual([
        { id: 'rep1', targetType: 'media', targetId: 'movie_9', reason: 'spam', createdAt: '2026-06-01' },
      ])
    })

    it('grupos de los que es miembro o dueño, con su rol; nunca los ajenos', async () => {
      const body = await exportAll()
      const byId = Object.fromEntries(body.groups.map((g: { id: string }) => [g.id, g]))
      expect(Object.keys(byId).sort()).toEqual(['g1', 'g2'])
      expect(byId.g1).toMatchObject({ name: 'Cine', role: 'member', isOwner: false, joinedAt: '2026-01-10' })
      expect(byId.g2).toMatchObject({ name: 'Mío', role: 'owner', isOwner: true, icon: 'cat', isPublic: false })
      expect(body.groupInvitations.map((i: { id: string }) => i.id)).toEqual(['i1'])
    })

    it('recomendaciones enviadas y recibidas, con el nombre de la otra persona', async () => {
      const body = await exportAll()
      expect(body.recommendations.sent).toEqual([
        expect.objectContaining({ id: 'r1', toUserId: OTHER, toUsername: 'bob', mediaId: 'movie_550', message: 'mírala' }),
      ])
      expect(body.recommendations.received).toEqual([
        expect.objectContaining({ id: 'r2', fromUserId: OTHER, fromUsername: 'bob', readAt: '2026-04-03' }),
      ])
    })

    it('conversaciones: solo las suyas, con participantes, sin el contenido ajeno', async () => {
      const body = await exportAll()
      expect(body.conversations).toEqual([
        {
          id: 'c1',
          createdAt: '2026-01-01',
          lastMessageAt: '2026-01-03',
          lastReadAt: '2026-01-05',
          members: [
            { userId: ME, username: 'alice' },
            { userId: OTHER, username: 'bob' },
          ],
        },
      ])
      expect(JSON.stringify(body)).not.toContain('de bob')
      expect(JSON.stringify(body)).not.toContain('ajeno')
    })

    it('una tabla que aún no existe en este proyecto no tumba el export', async () => {
      arrange()
      adminState.db.failures.group_invitations = { code: '42P01', message: 'relation does not exist' }
      const res = await (await import('@/app/api/account/export/route')).GET()
      expect(res.status).toBe(200)
      expect((await res.json()).groupInvitations).toEqual([])
    })

    it('cualquier otro error de base → 500 (mejor reintentar que entregar un export incompleto)', async () => {
      arrange()
      adminState.db.failures.messages = { code: '57014', message: 'timeout' }
      const res = await (await import('@/app/api/account/export/route')).GET()
      expect(res.status).toBe(500)
    })

    it('pagina las tablas largas (más de 1000 mensajes)', async () => {
      arrange()
      adminState.db.tables.messages = Array.from({ length: 2345 }, (_, i) => ({
        id: `m${String(i).padStart(5, '0')}`, conversation_id: 'c1', sender_id: ME, content: String(i), created_at: '2026-01-01',
      }))
      const body = await (await (await import('@/app/api/account/export/route')).GET()).json()
      expect(body.messages).toHaveLength(2345)
    })
  })
})
