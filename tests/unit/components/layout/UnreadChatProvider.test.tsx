// ============================================================
// KULTURA — UnreadChatProvider unit tests (E96)
// Count inicial vía /api/chat?countOnly=1, refetch al recibir INSERT
// realtime ajeno fuera de la conversación abierta, ignorar mensajes
// propios o de la conversación activa, y markConversationRead.
// ============================================================

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockPathname = '/home'
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Supabase client mock: canal realtime con captura del handler + update chain
type RealtimeHandler = (payload: { new: { conversation_id: string; sender_id: string } }) => void
let capturedHandler: RealtimeHandler | null = null
const mockRemoveChannel = vi.fn()
const mockUpdateEq2 = vi.fn()
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))
const mockSetAuth = vi.fn()
const mockGetSession = vi.fn()
type AuthCallback = (event: string, session: { access_token: string } | null) => void
let capturedAuthCallback: AuthCallback | null = null
const mockAuthUnsubscribe = vi.fn()
const mockOnAuthStateChange = vi.fn((cb: AuthCallback) => {
  capturedAuthCallback = cb
  return { data: { subscription: { unsubscribe: mockAuthUnsubscribe } } }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
    realtime: { setAuth: mockSetAuth },
    channel: () => {
      const chain = {
        on: (_event: string, _cfg: unknown, handler: RealtimeHandler) => {
          capturedHandler = handler
          return chain
        },
        subscribe: () => chain,
      }
      return chain
    },
    removeChannel: mockRemoveChannel,
    from: () => ({ update: mockUpdate }),
  }),
}))

import { UnreadChatProvider, useUnreadChat } from '@/components/layout/UnreadChatProvider'

function Consumer() {
  const { unreadCount, markConversationRead } = useUnreadChat()
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <button onClick={() => markConversationRead('conv-1')}>mark</button>
    </div>
  )
}

const mockFetch = vi.fn()

function stubCount(count: number) {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ count }) })
}

function renderProvider(userId = 'me') {
  return render(
    <UnreadChatProvider userId={userId}>
      <Consumer />
    </UnreadChatProvider>
  )
}

describe('UnreadChatProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = null
    mockPathname = '/home'
    capturedAuthCallback = null
    mockUpdateEq2.mockResolvedValue({ data: null, error: null })
    mockSetAuth.mockResolvedValue(undefined)
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'jwt-token' } } })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('sin provider, useUnreadChat devuelve default 0 (componentes nav no rompen)', () => {
    render(<Consumer />)
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('fetch inicial del count al montar', async () => {
    stubCount(2)
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(mockFetch).toHaveBeenCalledWith('/api/chat?countOnly=1')
  })

  it('REGRESIÓN E96-fix: setAuth con el JWT de la sesión COMPLETADO antes de suscribir', async () => {
    // Un canal que hace phx_join sin token queda SUBSCRIBED pero WALRUS
    // descarta todos los eventos, y un access_token posterior no re-autoriza
    // la suscripción postgres_changes. setAuth debe completarse antes.
    stubCount(0)
    renderProvider()
    await waitFor(() => expect(capturedHandler).not.toBeNull())
    expect(mockSetAuth).toHaveBeenCalledWith('jwt-token')
  })

  it('REGRESIÓN E96-fix: sin sesión NO suscribe (nunca join como anon)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    stubCount(0)
    renderProvider()
    // dar margen a los microtasks del efecto
    await act(async () => { await Promise.resolve() })
    expect(capturedHandler).toBeNull()
    expect(mockSetAuth).not.toHaveBeenCalled()
  })

  it('REGRESIÓN E96-fix: INITIAL_SESSION con sesión (vía onAuthStateChange) dispara la suscripción', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    stubCount(0)
    renderProvider()
    await waitFor(() => expect(capturedAuthCallback).not.toBeNull())
    expect(capturedHandler).toBeNull()

    await act(async () => {
      capturedAuthCallback!('INITIAL_SESSION', { access_token: 'jwt-cookie' })
    })
    await waitFor(() => expect(capturedHandler).not.toBeNull())
    expect(mockSetAuth).toHaveBeenCalledWith('jwt-cookie')
  })

  it('evento auth posterior con canal ya suscrito refresca el token sin resuscribir', async () => {
    stubCount(0)
    renderProvider()
    await waitFor(() => expect(capturedHandler).not.toBeNull())
    const handlerBefore = capturedHandler

    await act(async () => {
      capturedAuthCallback!('TOKEN_REFRESHED', { access_token: 'jwt-refrescado' })
    })
    expect(mockSetAuth).toHaveBeenCalledWith('jwt-refrescado')
    expect(capturedHandler).toBe(handlerBefore)
  })

  it('INSERT ajeno fuera de la conversación abierta → refetch del count', async () => {
    stubCount(1)
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    await waitFor(() => expect(capturedHandler).not.toBeNull())

    stubCount(2)
    await act(async () => {
      capturedHandler!({ new: { conversation_id: 'conv-9', sender_id: 'other-user' } })
    })
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('mensaje propio (sender_id = yo) NO refetchea', async () => {
    stubCount(1)
    renderProvider('me')
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(capturedHandler).not.toBeNull())

    await act(async () => {
      capturedHandler!({ new: { conversation_id: 'conv-9', sender_id: 'me' } })
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('mensaje en la conversación ABIERTA (pathname /chat/[id]) NO refetchea', async () => {
    mockPathname = '/chat/conv-open'
    stubCount(0)
    renderProvider()
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(capturedHandler).not.toBeNull())

    await act(async () => {
      capturedHandler!({ new: { conversation_id: 'conv-open', sender_id: 'other-user' } })
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('markConversationRead: update de last_read_at (conv + user propios) y refetch', async () => {
    stubCount(3)
    renderProvider('me')
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'))

    stubCount(2)
    await act(async () => {
      fireEvent.click(screen.getByText('mark'))
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_read_at: expect.any(String) })
    )
    expect(mockUpdateEq1).toHaveBeenCalledWith('conversation_id', 'conv-1')
    expect(mockUpdateEq2).toHaveBeenCalledWith('user_id', 'me')
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
  })

  it('desmonta el canal realtime al desmontar', async () => {
    stubCount(0)
    const { unmount } = renderProvider()
    await waitFor(() => expect(capturedHandler).not.toBeNull())
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
