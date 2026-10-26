// ============================================================
// F-33 (remate) — Avisos push ofrecidos en contexto.
// Nunca al cargar: solo tras enviar un mensaje o pedir/aceptar una amistad,
// con push en el servidor, soporte en el navegador y permiso en «default».
// ============================================================

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}))

import { PushOffer } from '@/components/push/PushOffer'
import { offerPushInContext, PUSH_OFFER_DISMISSED_KEY } from '@/lib/push/offer'
import { fromBase64Url } from '@/lib/push/base64url'

const KEY = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
const EP = 'https://fcm.googleapis.com/fcm/send/this-device'

const fetchMock = vi.fn()
let notification: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> }

function install({
  permission = 'default' as NotificationPermission,
  answer = 'granted' as NotificationPermission,
  enabled = true,
  push = true,
} = {}) {
  let current: unknown = null
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = {
        endpoint: EP,
        expirationTime: null,
        options: { applicationServerKey: fromBase64Url(KEY)!.buffer },
        getKey: () => new Uint8Array(16).fill(7).buffer,
        unsubscribe: vi.fn(async () => true),
      }
      return current
    }),
  }
  const registration = { active: {}, pushManager }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration, ready: Promise.resolve(registration) },
  })
  const w = window as unknown as Record<string, unknown>
  if (push) w.PushManager = function PushManager() {}
  else delete w.PushManager
  notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = answer
      return answer
    }),
  }
  w.Notification = notification
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/push/status') {
      return new Response(JSON.stringify({ enabled, publicKey: enabled ? KEY : null, devices: 0, endpointHashes: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
  return { pushManager }
}

const statusCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/push/status').length

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PushOffer', () => {
  it('al cargar no pregunta nada ni pinta nada', async () => {
    install()
    render(<PushOffer />)
    await act(async () => {})
    expect(screen.queryByTestId('push-offer')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(notification.requestPermission).not.toHaveBeenCalled()
  })

  it('tras enviar un mensaje lo ofrece, y el permiso se pide solo al pulsar', async () => {
    const { pushManager } = install()
    render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    expect(await screen.findByTestId('push-offer')).toHaveTextContent('chatBody')
    expect(notification.requestPermission).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'enable' }))
    expect(notification.requestPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(pushManager.subscribe).toHaveBeenCalled())
    expect(await screen.findByText('done')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/push/subscribe')).toBe(true)
  })

  it('tras una amistad, con su texto', async () => {
    install()
    render(<PushOffer />)
    act(() => offerPushInContext('friends'))
    expect(await screen.findByTestId('push-offer')).toHaveTextContent('friendsBody')
  })

  it.each([
    ['permiso ya concedido', { permission: 'granted' as NotificationPermission }],
    ['permiso bloqueado', { permission: 'denied' as NotificationPermission }],
    ['navegador sin push', { push: false }],
  ])('%s: ni pregunta al servidor', async (_label, env) => {
    install(env)
    render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    await act(async () => {})
    expect(screen.queryByTestId('push-offer')).toBeNull()
    expect(statusCalls()).toBe(0)
  })

  it('push apagado en el servidor (PUSH_ENABLED): no se enseña', async () => {
    install({ enabled: false })
    render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    await waitFor(() => expect(statusCalls()).toBe(1))
    await act(async () => {})
    expect(screen.queryByTestId('push-offer')).toBeNull()
  })

  it('«Ahora no» lo descarta en este navegador', async () => {
    install()
    const { unmount } = render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    fireEvent.click(await screen.findByRole('button', { name: 'later' }))
    expect(screen.queryByTestId('push-offer')).toBeNull()
    expect(localStorage.getItem(PUSH_OFFER_DISMISSED_KEY)).not.toBeNull()
    unmount()

    sessionStorage.clear()
    render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    await act(async () => {})
    expect(screen.queryByTestId('push-offer')).toBeNull()
  })

  it('una vez por visita como mucho', async () => {
    install()
    render(<PushOffer />)
    act(() => offerPushInContext('chat'))
    await screen.findByTestId('push-offer')
    act(() => offerPushInContext('friends'))
    await act(async () => {})
    expect(statusCalls()).toBe(1)
    expect(screen.getByTestId('push-offer')).toHaveTextContent('chatBody')
  })
})
