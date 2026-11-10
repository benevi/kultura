// ============================================================
// KULTURA — Reautenticación antes de borrar la cuenta (saneamiento 1.1)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' },
}))

const mockSignIn = vi.fn()
const mockSignOut = vi.fn(async () => ({ error: null }))
const mockCreateClient = vi.fn((..._args: unknown[]) => ({
  auth: { signInWithPassword: mockSignIn, signOut: mockSignOut },
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

const NOW = Date.parse('2026-11-11T12:00:00Z')
const EMAIL_USER = {
  id: 'u-1',
  email: 'ana@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  last_sign_in_at: '2026-11-01T00:00:00Z',
}
const GOOGLE_USER = {
  id: 'u-2',
  email: 'bea@example.com',
  app_metadata: { provider: 'google', providers: ['google'] },
  last_sign_in_at: '2026-11-11T11:55:00Z',
}

describe('hasPasswordIdentity', () => {
  it('email (y email + Google) sí; solo Google, no', async () => {
    const { hasPasswordIdentity } = await import('@/lib/account/reauth')
    expect(hasPasswordIdentity(EMAIL_USER)).toBe(true)
    expect(hasPasswordIdentity({ app_metadata: { providers: ['google', 'email'] } })).toBe(true)
    expect(hasPasswordIdentity(GOOGLE_USER)).toBe(false)
    expect(hasPasswordIdentity({ app_metadata: { provider: 'email' } })).toBe(true)
    expect(hasPasswordIdentity({ app_metadata: {} })).toBe(false)
  })
})

describe('verifyDeletionIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cuenta con contraseña y sin contraseña en el cuerpo → password_required, sin llamar a Auth', async () => {
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    expect(await verifyDeletionIdentity(EMAIL_USER, null, NOW)).toEqual({ ok: false, code: 'password_required' })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('contraseña correcta → ok, con un cliente sin sesión guardada que luego se cierra', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    expect(await verifyDeletionIdentity(EMAIL_USER, 'buena', NOW)).toEqual({ ok: true })
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'buena' })
    expect(mockCreateClient.mock.calls[0][2]).toMatchObject({ auth: { persistSession: false, autoRefreshToken: false } })
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('contraseña incorrecta → wrong_password', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    expect(await verifyDeletionIdentity(EMAIL_USER, 'mala', NOW)).toEqual({ ok: false, code: 'wrong_password' })
  })

  it('si Auth devuelve OTRO usuario, no vale', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'otro' } }, error: null })
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    expect(await verifyDeletionIdentity(EMAIL_USER, 'buena', NOW)).toEqual({ ok: false, code: 'wrong_password' })
  })

  it('solo Google: vale un inicio de sesión de hace menos de 10 minutos', async () => {
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    expect(await verifyDeletionIdentity(GOOGLE_USER, null, NOW)).toEqual({ ok: true })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('solo Google: un inicio de sesión viejo (o sin fecha) → reauth_required', async () => {
    const { verifyDeletionIdentity } = await import('@/lib/account/reauth')
    const viejo = { ...GOOGLE_USER, last_sign_in_at: '2026-11-11T11:40:00Z' }
    expect(await verifyDeletionIdentity(viejo, null, NOW)).toEqual({ ok: false, code: 'reauth_required' })
    expect(await verifyDeletionIdentity({ ...GOOGLE_USER, last_sign_in_at: undefined }, null, NOW)).toEqual({
      ok: false,
      code: 'reauth_required',
    })
  })
})
