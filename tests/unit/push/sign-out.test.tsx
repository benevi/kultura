// ============================================================
// F-33 — Al cerrar sesión, el push de ESTE navegador se da de baja (en el
// servidor y en el navegador) ANTES del signOut, sin bloquearlo nunca.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    key === 'accountMenu' ? `Cuenta de ${values?.username}` : key,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
const order: string[] = []
const signOut = vi.fn(async () => {
  order.push('signOut')
  return {}
})
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }))

import { AvatarDropdown } from '@/components/layout/AvatarDropdown'
import { unsubscribeCurrentDevice, SIGN_OUT_PUSH_TIMEOUT_MS } from '@/lib/push/client'

const EP = 'https://fcm.googleapis.com/fcm/send/this-device'
const fetchMock = vi.fn()
let subscription: { endpoint: string; unsubscribe: ReturnType<typeof vi.fn> } | null

function installWorker(sub: typeof subscription) {
  subscription = sub
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) },
  })
  ;(window as unknown as Record<string, unknown>).PushManager = function PushManager() {}
}

const deviceSub = () => ({
  endpoint: EP,
  unsubscribe: vi.fn(async () => {
    order.push('browser-unsubscribe')
    return true
  }),
})

beforeEach(() => {
  vi.clearAllMocks()
  order.length = 0
  fetchMock.mockImplementation(async (url: string) => {
    order.push(`fetch ${url}`)
    return new Response('{"ok":true}')
  })
  global.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => {
  vi.useRealTimers()
  delete (window as unknown as Record<string, unknown>).PushManager
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
})

describe('unsubscribeCurrentDevice', () => {
  it('sin service worker o sin suscripción no hace ni una petición', async () => {
    await unsubscribeCurrentDevice()
    installWorker(null)
    await unsubscribeCurrentDevice()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('con suscripción: baja en el servidor con su endpoint y luego en el navegador', async () => {
    installWorker(deviceSub())
    await unsubscribeCurrentDevice()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push/unsubscribe')
    expect(JSON.parse(init.body)).toEqual({ endpoint: EP })
    expect(order).toEqual(['fetch /api/push/unsubscribe', 'browser-unsubscribe'])
  })

  it('si el servidor falla, se borra igual en el navegador y no lanza', async () => {
    installWorker(deviceSub())
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(unsubscribeCurrentDevice()).resolves.toBeUndefined()
    expect(subscription!.unsubscribe).toHaveBeenCalled()
  })

  it('si la red se cuelga, deja seguir como mucho en el tiempo límite', async () => {
    vi.useFakeTimers()
    installWorker(deviceSub())
    fetchMock.mockImplementation(() => new Promise(() => {}))
    let done = false
    const p = unsubscribeCurrentDevice().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(SIGN_OUT_PUSH_TIMEOUT_MS + 300)
    await p
    expect(done).toBe(true)
  })
})

describe('Cerrar sesión desde el menú del avatar', () => {
  it('da de baja el push de este navegador ANTES del signOut', async () => {
    installWorker(deviceSub())
    render(<AvatarDropdown username="ana" avatarColor="blue" avatarInitials="AN" avatarIcon={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'signOut' }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(order).toEqual(['fetch /api/push/unsubscribe', 'browser-unsubscribe', 'signOut'])
  })

  it('sin push en el navegador cierra sesión igual, sin peticiones de más', async () => {
    render(<AvatarDropdown username="ana" avatarColor="blue" avatarInitials="AN" avatarIcon={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'signOut' }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
