// D-12 / CRE-7: el alta guarda su canal, registra signup_completed y aplica la
// invitación firmada; el callback lo hace en las tres vías de alta sin
// cambiar adónde se va (onboarding).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  account: { data: null as unknown, error: null as unknown },
  track: vi.fn(),
  acceptInvite: vi.fn(),
  updateUser: vi.fn(),
  exchange: vi.fn(),
}))

vi.mock('@/lib/analytics/track', () => ({ track: h.track }))
vi.mock('@/lib/analytics/invite', () => ({ acceptInvite: h.acceptInvite }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: h.exchange,
      verifyOtp: async () => ({ error: null }),
      getUser: async () => ({ data: { user: h.user } }),
      updateUser: h.updateUser,
    },
    from: (table: string) => {
      if (table === 'account_state') {
        const c = { select: () => c, eq: () => c, maybeSingle: async () => h.account }
        return c
      }
      const u = { update: () => u, eq: () => u, is: async () => ({ error: null }) }
      return u
    },
  }),
}))

import { recordSignup, resolveSignupAttribution } from '@/lib/analytics/signup'
import { GET } from '@/app/api/auth/callback/route'

const SIG = '1790000000.0123456789abcdef0123456789abcdef'
const recent = () => new Date(Date.now() - 60_000).toISOString()
const call = (query: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  GET(new NextRequest(`https://k.test/api/auth/callback${query}`, { headers }))

beforeEach(() => {
  vi.clearAllMocks()
  h.track.mockResolvedValue(true)
  h.acceptInvite.mockResolvedValue('accepted')
  h.updateUser.mockResolvedValue({ data: {}, error: null })
  h.exchange.mockResolvedValue({ error: null })
  h.user = { id: 'u1', created_at: recent(), app_metadata: { provider: 'google' }, user_metadata: {} }
  h.account = { data: { onboarded_at: null }, error: null }
})

describe('resolveSignupAttribution', () => {
  it('manda la URL; si no trae nada, lo guardado en el signUp; si no, direct', () => {
    expect(resolveSignupAttribution({ channel: 'utm', utm_source: 'x', inv: SIG, ref: 'ana' }, { channel: 'ref', ref: 'bea' }))
      .toEqual({ channel: 'utm', utm_source: 'x', ref: 'ana' })
    expect(resolveSignupAttribution({ channel: 'direct' }, { channel: 'ref', ref: 'bea' })).toEqual({ channel: 'ref', ref: 'bea' })
    expect(resolveSignupAttribution({ channel: 'direct' }, undefined)).toEqual({ channel: 'direct' })
  })
})

describe('recordSignup', () => {
  const supabase = { auth: { updateUser: h.updateUser } } as never

  it('Google con utm: guarda la atribución en los metadatos y registra el alta (una vez)', async () => {
    const res = await recordSignup(supabase, h.user as never, { channel: 'utm', utm_source: 'reddit' })
    expect(h.updateUser).toHaveBeenCalledWith({ data: { attribution: { channel: 'utm', utm_source: 'reddit' } } })
    expect(h.track).toHaveBeenCalledWith(
      h.user,
      'signup_completed',
      { channel: 'utm', utm_source: 'reddit', provider: 'google' },
      { dedupeKey: 'signup_completed:u1' },
    )
    expect(h.acceptInvite).not.toHaveBeenCalled()
    expect(res?.attribution.channel).toBe('utm')
  })

  it('alta por correo: no pisa la atribución que ya trae el signUp', async () => {
    h.user = { ...h.user!, app_metadata: { provider: 'email' }, user_metadata: { attribution: { channel: 'ref', ref: 'ana' } } }
    await recordSignup(supabase, h.user as never, { channel: 'direct' })
    expect(h.updateUser).not.toHaveBeenCalled()
    expect(h.track).toHaveBeenCalledWith(expect.anything(), 'signup_completed', { channel: 'ref', ref: 'ana', provider: 'email' }, expect.anything())
  })

  it('invitación: solo con ref + firma en la URL', async () => {
    await recordSignup(supabase, h.user as never, { channel: 'ref', ref: 'ana', inv: SIG })
    expect(h.acceptInvite).toHaveBeenCalledWith(h.user, 'ana', SIG)
    h.acceptInvite.mockClear()
    await recordSignup(supabase, h.user as never, { channel: 'ref', ref: 'ana' })
    expect(h.acceptInvite).not.toHaveBeenCalled()
  })

  it('la demo no cuenta', async () => {
    expect(await recordSignup(supabase, { id: 'd', app_metadata: { demo: true }, user_metadata: {} } as never, { channel: 'direct' })).toBeNull()
    expect(h.track).not.toHaveBeenCalled()
  })
})

describe('callback (D-12)', () => {
  it('primera vez con Google: atribución e invitación desde la URL, y sigue a /welcome', async () => {
    const res = await call(`?code=abc&next=%2Fes%2Fhome&utm_source=reddit&ref=ana&inv=${SIG}`)
    expect(res.headers.get('location')).toBe('https://k.test/es/welcome?next=%2Fes%2Fhome')
    expect(h.track).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'signup_completed',
      expect.objectContaining({ channel: 'utm', utm_source: 'reddit', ref: 'ana', provider: 'google' }),
      { dedupeKey: 'signup_completed:u1' },
    )
    expect(h.acceptInvite).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'ana', SIG)
  })

  it('cuenta ANTIGUA sin onboarding terminado: ni alta ni invitación (aunque venga con ref e inv)', async () => {
    h.user = { ...h.user!, created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:05:00Z' }
    h.account = { data: { onboarded_at: null }, error: null }
    const res = await call(`?code=abc&next=%2Fes%2Fhome&ref=x&inv=${SIG}`)
    // Sigue yendo al onboarding como hoy, pero sin medir ni hacerse amiga de X.
    expect(res.headers.get('location')).toBe('https://k.test/es/welcome?next=%2Fes%2Fhome')
    expect(h.track).not.toHaveBeenCalled()
    expect(h.acceptInvite).not.toHaveBeenCalled()
  })

  it('enlace de confirmación del alta (type=signup): cuenta de ayer con el correo recién confirmado sí cuenta', async () => {
    h.user = { ...h.user!, created_at: new Date(Date.now() - 86_400_000).toISOString(), email_confirmed_at: recent() }
    await call(`?token_hash=t&type=signup&next=%2Fes%2Fhome&ref=ana&inv=${SIG}`)
    expect(h.track).toHaveBeenCalled()
    expect(h.acceptInvite).toHaveBeenCalled()
  })

  it('cuenta que ya hizo el onboarding: no se registra otra alta', async () => {
    h.account = { data: { onboarded_at: '2026-10-01T00:00:00Z' }, error: null }
    const res = await call('?code=abc&next=%2Fes%2Flibrary&utm_source=x')
    expect(res.headers.get('location')).toBe('https://k.test/es/library')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('alta inmediata por correo (flow=signup, sin código): registra y va a /welcome', async () => {
    h.user = { ...h.user!, app_metadata: { provider: 'email' }, user_metadata: { attribution: { channel: 'utm', utm_source: 'x' } } }
    h.account = { data: null, error: { code: 'PGRST205' } }
    const res = await call('?flow=signup&next=%2Fes%2Fu%2Fana&utm_source=x')
    expect(res.headers.get('location')).toBe('https://k.test/es/welcome?next=%2Fes%2Fu%2Fana')
    expect(h.track).toHaveBeenCalledWith(expect.anything(), 'signup_completed', expect.objectContaining({ channel: 'utm' }), expect.anything())
  })

  it('flow=signup con una cuenta antigua no reabre el alta', async () => {
    h.user = { ...h.user!, created_at: '2026-01-01T00:00:00Z' }
    h.account = { data: { onboarded_at: '2026-01-02T00:00:00Z' }, error: null }
    const res = await call('?flow=signup&next=%2Fes%2Fhome')
    expect(res.headers.get('location')).toBe('https://k.test/es/home')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('flow=signup desde otro sitio (CSRF): no acepta invitaciones ni registra nada', async () => {
    const q = `?flow=signup&next=%2Fes%2Fhome&ref=malo&inv=${SIG}`
    const attempts: Array<Record<string, string>> = [{ 'sec-fetch-site': 'cross-site' }, { referer: 'https://evil.test/x' }, {}]
    for (const headers of attempts) {
      const res = await call(q, headers)
      expect(res.headers.get('location')).toBe('https://k.test/es/login?error=auth_callback_error')
    }
    expect(h.acceptInvite).not.toHaveBeenCalled()
    expect(h.track).not.toHaveBeenCalled()
    // Sin Sec-Fetch-Site, un Referer propio sí vale.
    const ok = await call('?flow=signup&next=%2Fes%2Fhome', { referer: 'https://k.test/es/login?mode=register' })
    expect(ok.headers.get('location')).toBe('https://k.test/es/welcome?next=%2Fes%2Fhome')
  })

  it('flow=signup sin sesión: al destino, sin medir', async () => {
    h.user = null
    const res = await call('?flow=signup&next=%2Fes%2Fhome')
    expect(res.headers.get('location')).toBe('https://k.test/es/home')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('si medir falla, entrar no se rompe', async () => {
    h.track.mockRejectedValue(new Error('boom'))
    h.updateUser.mockRejectedValue(new Error('boom'))
    const res = await call('?code=abc&next=%2Fes%2Fhome')
    expect(res.headers.get('location')).toBe('https://k.test/es/welcome?next=%2Fes%2Fhome')
  })
})
