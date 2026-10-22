// ============================================================
// KULTURA — /api/settings unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

const AUTH_USER = { id: 'user-001', email: 'test@example.com' }

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}))

/** Cadena `update().eq().select().single()` que guarda lo que se escribe. */
function updateChain(result: { data: unknown; error: unknown }) {
  const update = vi.fn().mockReturnThis()
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update,
    single: vi.fn().mockResolvedValue(result),
  }
  return { chain, update }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns user settings for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockSingle = vi.fn().mockResolvedValue({
      data: { username: 'testuser', avatar_color: 'blue', preferred_locale: 'es' },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    })

    const { GET } = await import('@/app/api/settings/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.username).toBe('testuser')
    expect(body.avatar_color).toBe('blue')
  })
})

describe('PATCH /api/settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 if not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'newname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(401)
  })

  it('updates username successfully (con el cliente admin)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const user = updateChain({ data: null, error: null })
    const admin = updateChain({
      data: { username: 'newname', avatar_color: 'blue', preferred_locale: 'es' },
      error: null,
    })
    mockFrom.mockReturnValue(user.chain)
    mockAdminFrom.mockReturnValue(admin.chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'newname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // La base ya no deja cambiar `username` con el JWT del usuario.
    expect(admin.update).toHaveBeenCalledWith({ username: 'newname' })
    expect(user.update).not.toHaveBeenCalled()
  })

  it('el resto de campos se escribe con el JWT del usuario, no con admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const user = updateChain({ data: { avatar_color: 'teal' }, error: null })
    mockFrom.mockReturnValue(user.chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ avatar_color: 'teal' }) as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(user.update).toHaveBeenCalledWith({ avatar_color: 'teal' })
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })

  it('returns 409 si otro usuario se queda el nombre durante la escritura (23505)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    mockFrom.mockReturnValue(updateChain({ data: null, error: null }).chain)
    mockAdminFrom.mockReturnValue(updateChain({ data: null, error: { code: '23505' } }).chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'racename' }) as import('next/server').NextRequest)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('username_taken')
  })

  it('la cuenta demo no puede cambiar nada (el admin no la frena)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...AUTH_USER, app_metadata: { demo: true } } },
      error: null,
    })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'hacked' }) as import('next/server').NextRequest)
    expect(res.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })

  it('guarda la bio recortada', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const user = updateChain({ data: { bio: 'hola' }, error: null })
    mockFrom.mockReturnValue(user.chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ bio: '  hola  ' }) as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(user.update).toHaveBeenCalledWith({ bio: 'hola' })
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })

  it('una bio vacía se guarda como null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const user = updateChain({ data: { bio: null }, error: null })
    mockFrom.mockReturnValue(user.chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ bio: '   ' }) as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(user.update).toHaveBeenCalledWith({ bio: null })
  })

  it('returns 400 para una bio de 5.000 caracteres', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const user = updateChain({ data: {}, error: null })
    mockFrom.mockReturnValue(user.chain)

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ bio: 'x'.repeat(5000) }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    expect(user.update).not.toHaveBeenCalled()
  })

  it('returns 400 for username with special characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'invalid name!' }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 409 if username is already taken', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'other-user' }, error: null })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })

    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ username: 'takenname' }) as import('next/server').NextRequest)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('username_taken')
  })

  it('returns 400 for invalid avatar_color', async () => {
    mockGetUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null })
    const { PATCH } = await import('@/app/api/settings/route')
    const res = await PATCH(makeRequest({ avatar_color: '#ff0000' }) as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })
})
