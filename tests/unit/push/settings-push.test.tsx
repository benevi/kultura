// ============================================================
// F-33 — Ajustes › notificaciones push de este dispositivo.
// El permiso solo se pide al pulsar; la baja (aquí y en todos) funciona.
// ============================================================

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns === 'push.settings' ? 'push.' : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/es/settings' }))
vi.mock('@/components/ui/ToastProvider', () => ({ useToastContext: () => ({ show: vi.fn(), dismiss: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))
vi.mock('@/lib/library/actions', () => ({ saveRatingScale: vi.fn() }))

import { SettingsForm } from '@/app/[locale]/(app)/settings/SettingsForm'
import { fromBase64Url } from '@/lib/push/base64url'
import { endpointHash } from '@/lib/push/endpoint'

const PROPS = { initialUsername: 'ana', initialAvatarColor: 'blue', initialAvatarIcon: null, initialLocale: 'es', userEmail: 'ana@example.com' }
const KEY = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
const OTHER_KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
const EP = 'https://fcm.googleapis.com/fcm/send/this-device'

function fakeSubscription(endpoint: string, key: string) {
  return {
    endpoint,
    expirationTime: null,
    options: { applicationServerKey: fromBase64Url(key)!.buffer },
    getKey: (name: string) => (name === 'p256dh' ? fromBase64Url(KEY)!.buffer : new Uint8Array(16).fill(7).buffer),
    unsubscribe: vi.fn(async () => true),
  }
}
type FakeSub = ReturnType<typeof fakeSubscription>

interface Env {
  permission?: NotificationPermission
  answer?: NotificationPermission
  subscription?: FakeSub | null
  status?: Record<string, unknown> | null
  ios?: boolean
}

const fetchMock = vi.fn()
let current: FakeSub | null
let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }
let notification: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> }

function install({ permission = 'default', answer = 'granted', subscription = null, status, ios = false }: Env = {}) {
  current = subscription
  pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = fakeSubscription(EP, KEY))),
  }
  const registration = { active: {}, pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration, ready: Promise.resolve(registration) },
  })
  ;(window as unknown as Record<string, unknown>).PushManager = function PushManager() {}
  notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = answer
      return answer
    }),
  }
  ;(window as unknown as Record<string, unknown>).Notification = notification
  if (ios) Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' })
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/push/status') {
      return new Response(JSON.stringify(status ?? { enabled: true, publicKey: KEY, devices: 0, endpointHashes: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
}

const posts = (path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url === path && init?.method === 'POST').map(([, init]) => JSON.parse(init.body as string))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).PushManager
  delete (window as unknown as Record<string, unknown>).Notification
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
  delete (navigator as unknown as Record<string, unknown>).userAgent
})

describe('Ajustes › push', () => {
  it('navegador sin push: no aparece y ni siquiera pregunta al servidor', async () => {
    fetchMock.mockResolvedValue(new Response('{}'))
    render(<SettingsForm {...PROPS} />)
    await act(async () => {})
    expect(screen.queryByText('push.label')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/push/status', expect.anything())
  })

  it('push apagado en el servidor: no aparece', async () => {
    install({ status: { enabled: false, publicKey: null, devices: 0, endpointHashes: [] } })
    render(<SettingsForm {...PROPS} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/push/status', expect.anything()))
    await act(async () => {})
    expect(screen.queryByText('push.label')).toBeNull()
  })

  it('al cargar NO pide permiso; al pulsar sí, se suscribe con la clave del servidor y lo da de alta', async () => {
    install()
    render(<SettingsForm {...PROPS} />)
    const toggle = await screen.findByRole('switch', { name: 'push.label' })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText('push.off')).toHaveAttribute('role', 'status')
    expect(notification.requestPermission).not.toHaveBeenCalled()
    expect(pushManager.subscribe).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(notification.requestPermission).toHaveBeenCalledTimes(1)
    const opts = pushManager.subscribe.mock.calls[0][0]
    expect(opts.userVisibleOnly).toBe(true)
    expect(Array.from(opts.applicationServerKey as Uint8Array)).toEqual(Array.from(fromBase64Url(KEY)!))
    expect(posts('/api/push/subscribe')).toEqual([
      { endpoint: EP, keys: { p256dh: KEY, auth: 'BwcHBwcHBwcHBwcHBwcHBw' }, expirationTime: null, locale: 'es' },
    ])
    expect(screen.getByText('push.on')).toBeInTheDocument()
  })

  it('mientras se guarda: aria-disabled (no disabled), el foco no se pierde y no se repite la petición', async () => {
    install()
    let release: (r: Response) => void = () => {}
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/push/status'
        ? new Response(JSON.stringify({ enabled: true, publicKey: KEY, devices: 0, endpointHashes: [] }))
        : new Promise<Response>((r) => (release = r)),
    )
    render(<SettingsForm {...PROPS} />)
    const toggle = await screen.findByRole('switch', { name: 'push.label' })
    toggle.focus()
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-disabled', 'true'))
    expect(toggle).not.toBeDisabled()
    expect(document.activeElement).toBe(toggle)
    fireEvent.click(toggle)
    await act(async () => {})
    expect(posts('/api/push/subscribe')).toHaveLength(1)
    await act(async () => release(new Response('{}', { status: 201 })))
    await waitFor(() => expect(toggle).toBeChecked())
    expect(toggle).not.toHaveAttribute('aria-disabled')
  })

  it('si no da permiso: sigue apagado y lo explica; si lo bloquea, cómo desbloquearlo', async () => {
    install({ answer: 'default' })
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'push.label' }))
    expect(await screen.findByText('push.dismissed')).toBeInTheDocument()
    expect(pushManager.subscribe).not.toHaveBeenCalled()

    notification.requestPermission.mockImplementation(async () => 'denied')
    fireEvent.click(screen.getByRole('switch', { name: 'push.label' }))
    expect(await screen.findByText('push.denied')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'push.label' })).toBeDisabled()
  })

  it('si el servidor no la guarda, deshace la suscripción local y avisa', async () => {
    install()
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/push/status'
        ? new Response(JSON.stringify({ enabled: true, publicKey: KEY, devices: 0, endpointHashes: [] }))
        : new Response('{}', { status: 500 }),
    )
    render(<SettingsForm {...PROPS} />)
    const toggle = await screen.findByRole('switch', { name: 'push.label' })
    fireEvent.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('push.error')
    expect(toggle).not.toBeChecked()
    expect(current!.unsubscribe).toHaveBeenCalled()
  })

  it('activada en este dispositivo: se ve encendida, se refresca en silencio y se puede apagar', async () => {
    const sub = fakeSubscription(EP, KEY)
    install({ permission: 'granted', subscription: sub, status: { enabled: true, publicKey: KEY, devices: 1, endpointHashes: [await endpointHash(EP)] } })
    render(<SettingsForm {...PROPS} />)
    const toggle = await screen.findByRole('switch', { name: 'push.label' })
    await waitFor(() => expect(toggle).toBeChecked())
    await waitFor(() => expect(posts('/api/push/subscribe')).toHaveLength(1))
    expect(notification.requestPermission).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(posts('/api/push/unsubscribe')).toEqual([{ endpoint: EP }])
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(screen.getByText('push.off')).toBeInTheDocument()
  })

  it('dada de baja desde otro dispositivo: aparece apagada y se borra también aquí', async () => {
    const sub = fakeSubscription(EP, KEY)
    install({ permission: 'granted', subscription: sub, status: { enabled: true, publicKey: KEY, devices: 0, endpointHashes: [] } })
    render(<SettingsForm {...PROPS} />)
    const toggle = await screen.findByRole('switch', { name: 'push.label' })
    await waitFor(() => expect(sub.unsubscribe).toHaveBeenCalled())
    expect(toggle).not.toBeChecked()
    expect(posts('/api/push/subscribe')).toEqual([])
  })

  it('cambió el par VAPID: se vuelve a suscribir sin preguntar y sustituye la vieja', async () => {
    const old = fakeSubscription('https://fcm.googleapis.com/fcm/send/old', OTHER_KEY)
    install({ permission: 'granted', subscription: old, status: { enabled: true, publicKey: KEY, devices: 1, endpointHashes: [await endpointHash(old.endpoint)] } })
    render(<SettingsForm {...PROPS} />)
    await waitFor(() => expect(posts('/api/push/subscribe')).toHaveLength(1))
    expect(old.unsubscribe).toHaveBeenCalled()
    expect(notification.requestPermission).not.toHaveBeenCalled()
    expect(posts('/api/push/subscribe')[0]).toMatchObject({ endpoint: EP, replaces: old.endpoint })
  })

  it('otros dispositivos: lo dice y «Desactivar en todos» los da de baja', async () => {
    const sub = fakeSubscription(EP, KEY)
    install({ permission: 'granted', subscription: sub, status: { enabled: true, publicKey: KEY, devices: 3, endpointHashes: [await endpointHash(EP), 'a', 'b'] } })
    render(<SettingsForm {...PROPS} />)
    expect(await screen.findByText('push.otherDevices(2)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'push.disableAll' }))
    expect(await screen.findByText('push.allOff')).toBeInTheDocument()
    expect(posts('/api/push/unsubscribe')).toEqual([{ all: true }])
    expect(screen.queryByText('push.otherDevices(2)')).toBeNull()
  })

  it('iPhone sin instalar: explica cómo instalar la app y no deja activar', async () => {
    install({ ios: true })
    delete (window as unknown as Record<string, unknown>).PushManager
    render(<SettingsForm {...PROPS} />)
    expect(await screen.findByText('push.iosInstall')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'push.label' })).toBeDisabled()
  })

  it('demo: se ve pero no se puede activar', async () => {
    install()
    render(<SettingsForm {...PROPS} isDemo />)
    expect(await screen.findByText('push.demo')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'push.label' })).toBeDisabled()
  })
})
