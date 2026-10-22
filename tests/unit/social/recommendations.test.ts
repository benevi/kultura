// ============================================================
// KULTURA — Route Handler /api/recommendations unit tests
// Verifica autenticación, validación y creación de recomendaciones.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const AUTH_USER = { id: 'user-001' }
const RECEIVER_ID = 'user-002'
const MEDIA_ID = 'movie_550'

const mockGetUser = vi.fn()
const mockFromUsers = vi.fn()
const mockFromMedia = vi.fn()
const mockFromRecommendations = vi.fn()
const mockFromNotifications = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'users') return mockFromUsers()
      if (table === 'media') return mockFromMedia()
      if (table === 'recommendations') return mockFromRecommendations()
      if (table === 'notifications') return mockFromNotifications()
      return {}
    }),
  }),
}))

// E83: la notif se inserta vía admin client (service-role), no vía el server client.
const mockAdminNotifInsert = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) =>
      table === 'notifications' ? { insert: mockAdminNotifInsert } : {}
    ),
  }),
}))

// La fila de `media` la garantiza el servidor (SEG-2); se prueba en
// tests/unit/media. Aquí solo importa cómo la usa la ruta.
const mockEnsureMedia = vi.fn()
vi.mock('@/lib/media/upsert-from-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/upsert-from-provider')>()),
  upsertMediaFromProvider: (...a: unknown[]) => mockEnsureMedia(...a),
}))

describe('POST /api/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminNotifInsert.mockResolvedValue({ error: null })
    mockEnsureMedia.mockResolvedValue({ ok: true, id: MEDIA_ID, title: 'Fight Club', created: false })
  })

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 400 if toUserId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ mediaId: MEDIA_ID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('toUserId')
  })

  it('returns 400 if mediaId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('mediaId')
  })

  it('returns 400 if mediaId format is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: 'invalid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('format')
  })

  it('returns 400 if recommending to self', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: AUTH_USER.id, mediaId: MEDIA_ID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('yourself')
  })

  it('returns 400 if message exceeds max length (F4)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(
      makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID, message: 'x'.repeat(501) })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('too long')
  })

  it('returns 404 if receiver does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID }))
    expect(res.status).toBe(404)
  })

  it('creates recommendation and notification, returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockFromRecommendations.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rec-001' },
            error: null,
          }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recommendationId).toBe('rec-001')
    // E83: notif insertada vía admin client
    expect(mockAdminNotifInsert).toHaveBeenCalledOnce()
    expect(mockAdminNotifInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: RECEIVER_ID, type: 'recommendation' })
    )
  })

  it('garantiza la fila de media en el servidor e ignora mediaCache (SEG-2)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    mockFromMedia.mockReturnValue({ upsert: mockUpsert })
    mockFromRecommendations.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'rec-001' }, error: null }),
        }),
      }),
    })
    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({
      toUserId: RECEIVER_ID,
      mediaId: MEDIA_ID,
      mediaCache: { externalId: '550', type: 'movie', title: 'Otro título' },
    }))

    expect(res.status).toBe(201)
    expect(mockEnsureMedia).toHaveBeenCalledWith(MEDIA_ID, { locale: 'es' })
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockAdminNotifInsert).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ mediaTitle: 'Fight Club' }) })
    )
  })

  it('si el proveedor no da la ficha de un título nuevo → 502 sin recomendación', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockEnsureMedia.mockResolvedValue({ ok: false, id: MEDIA_ID, reason: 'unavailable' })
    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID }))

    expect(res.status).toBe(502)
    expect(mockFromRecommendations).not.toHaveBeenCalled()
  })

  it('E83: notif insert failure is logged but recommendation still returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFromUsers.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: RECEIVER_ID }, error: null }),
        }),
      }),
    })
    mockFromRecommendations.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'rec-001' }, error: null }),
        }),
      }),
    })
    mockAdminNotifInsert.mockResolvedValue({ error: { message: 'boom' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('@/app/api/recommendations/route')
    const res = await POST(makeRequest({ toUserId: RECEIVER_ID, mediaId: MEDIA_ID }))

    expect(res.status).toBe(201)
    expect(errSpy).toHaveBeenCalledWith(
      '[api/recommendations]',
      '[E83] notif insert failed',
      expect.objectContaining({ type: 'recommendation' })
    )
    errSpy.mockRestore()
  })
})
