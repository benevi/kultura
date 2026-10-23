// D-12: los utm_* y el ref (con su firma) viajan del enlace al alta por la
// URL: metadatos del signUp, enlace del correo, vuelta de Google y cambio de
// modo. Nada en cookies ni almacenamiento del navegador.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeAuth } from '../auth/fake-auth'

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import('../auth/fake-auth').createFakeAuth>,
  replace: vi.fn(),
  params: new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => h.fake.client }))
vi.mock('next-intl', async () => {
  const m = await import('../auth/fake-auth')
  return { useTranslations: () => m.fakeT }
})
vi.mock('@/i18n/navigation', async () => {
  const m = await import('../auth/fake-auth')
  return { Link: m.FakeLink }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => h.params,
}))

import { LoginPage } from '@/app/[locale]/login/LoginPage'

const SIG = '1790000000.0123456789abcdef0123456789abcdef'
const fetchMock = vi.fn()

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'user@example.com' } })
  fireEvent.change(screen.getByLabelText('password'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(document.querySelector('button[type="submit"]')!)
}

beforeEach(() => {
  h.fake = createFakeAuth()
  h.replace.mockReset()
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 307 }))
  vi.stubGlobal('fetch', fetchMock)
  h.params = new URLSearchParams(`mode=register&next=%2Fes%2Fu%2Fana&utm_source=Reddit&utm_campaign=otono&ref=ana&inv=${SIG}`)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage — atribución del alta (D-12)', () => {
  it('un alta con ?utm_source=x guarda utm_source (y el ref, sin la firma) en los metadatos', async () => {
    h.fake.requireEmailConfirmation(true)
    render(<LoginPage locale="es" />)
    fillAndSubmit()
    await waitFor(() => expect(h.fake.auth.signUp).toHaveBeenCalled())
    const args = h.fake.auth.signUp.mock.calls[0][0] as { options: { data: Record<string, unknown>; emailRedirectTo: string } }
    expect(args.options.data.attribution).toEqual({
      channel: 'utm', utm_source: 'reddit', utm_campaign: 'otono', ref: 'ana',
    })
    // El enlace del correo vuelve al callback con la atribución y la firma.
    const redirect = new URL(args.options.emailRedirectTo)
    expect(redirect.pathname).toBe('/api/auth/callback')
    expect(redirect.searchParams.get('next')).toBe('/es/u/ana')
    expect(redirect.searchParams.get('utm_source')).toBe('reddit')
    expect(redirect.searchParams.get('ref')).toBe('ana')
    expect(redirect.searchParams.get('inv')).toBe(SIG)
  })

  it('alta inmediata: avisa al callback (flow=signup) con la sesión y sigue al onboarding', async () => {
    render(<LoginPage locale="es" />)
    fillAndSubmit()
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/welcome?next=%2Fes%2Fu%2Fana'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const ping = new URL(url)
    expect(ping.pathname).toBe('/api/auth/callback')
    expect(ping.searchParams.get('flow')).toBe('signup')
    expect(ping.searchParams.get('inv')).toBe(SIG)
    expect(init).toMatchObject({ credentials: 'same-origin', redirect: 'manual', keepalive: true })
  })

  it('si el aviso falla, el alta sigue igual', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    render(<LoginPage locale="es" />)
    fillAndSubmit()
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/welcome?next=%2Fes%2Fu%2Fana'))
  })

  it('Google vuelve al callback con la atribución', async () => {
    render(<LoginPage locale="es" />)
    fireEvent.click(screen.getByRole('button', { name: /continueWithGoogle/ }))
    await waitFor(() => expect(h.fake.auth.signInWithOAuth).toHaveBeenCalled())
    const { options } = h.fake.auth.signInWithOAuth.mock.calls[0][0] as { options: { redirectTo: string } }
    const back = new URL(options.redirectTo)
    expect(back.searchParams.get('utm_campaign')).toBe('otono')
    expect(back.searchParams.get('ref')).toBe('ana')
    expect(back.searchParams.get('inv')).toBe(SIG)
  })

  it('cambiar a "entrar" conserva la atribución', () => {
    render(<LoginPage locale="es" />)
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
    const toLogin = hrefs.find((href) => href.startsWith('/login?') && !href.includes('mode=register') && !href.includes('mode=reset'))
    expect(toLogin).toBeDefined()
    expect(toLogin).toContain('utm_source=reddit')
    expect(toLogin).toContain(`inv=${SIG}`)
  })

  it('sin parámetros: canal direct y el callback sin extras', async () => {
    h.params = new URLSearchParams('mode=register')
    h.fake.requireEmailConfirmation(true)
    render(<LoginPage locale="en" />)
    fillAndSubmit()
    await waitFor(() => expect(h.fake.auth.signUp).toHaveBeenCalled())
    const args = h.fake.auth.signUp.mock.calls[0][0] as { options: { data: Record<string, unknown>; emailRedirectTo: string } }
    expect(args.options.data.attribution).toEqual({ channel: 'direct' })
    expect(args.options.emailRedirectTo).toBe(`${window.location.origin}/api/auth/callback?next=%2Fen%2Fhome`)
  })
})
