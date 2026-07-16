// ============================================================
// KULTURA — ConversationClient unit tests (E96)
// Flujo real del marcado de leído con el chat abierto:
// - al cargar la conversación se marca leída (el badge global baja al abrir)
// - al recibir un mensaje AJENO por realtime con el chat abierto se vuelve
//   a marcar leída (regresión: sin esto el badge contaría la conversación
//   que el usuario está mirando)
// - un mensaje propio (eco realtime) NO re-marca
// ============================================================

import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/components/ui/Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn() }),
}))

const mockMarkConversationRead = vi.fn()
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  useUnreadChat: () => ({
    unreadCount: 0,
    refreshUnread: vi.fn(),
    markConversationRead: mockMarkConversationRead,
  }),
}))

// Supabase: canal realtime con captura del handler + lookup del sender
type RealtimePayload = { new: { id: string; content: string; sender_id: string; created_at: string } }
type RealtimeHandler = (payload: RealtimePayload) => Promise<void>
let capturedHandler: RealtimeHandler | null = null

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
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
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { username: 'other', avatar_color: '#000', avatar_initials: 'OT' },
          }),
        }),
      }),
    }),
  }),
}))

import { ConversationClient } from '@/app/[locale]/(app)/chat/[id]/ConversationClient'

const otherUser = { id: 'other-user', username: 'other', avatar_color: '#000', avatar_initials: 'OT' }

const mockFetch = vi.fn()

function renderConversation() {
  return render(
    <ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" />
  )
}

describe('ConversationClient — marcado de leído (E96)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = null
    Element.prototype.scrollIntoView = vi.fn()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ messages: [] }) })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('al cargar los mensajes marca la conversación como leída', async () => {
    renderConversation()
    await waitFor(() => expect(mockMarkConversationRead).toHaveBeenCalledWith('conv-1'))
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/conv-1')
  })

  it('REGRESIÓN: mensaje ajeno recibido con el chat abierto → re-marca leída (badge no cuenta)', async () => {
    renderConversation()
    await waitFor(() => expect(mockMarkConversationRead).toHaveBeenCalledTimes(1))

    await act(async () => {
      await capturedHandler!({
        new: { id: 'msg-1', content: 'hola', sender_id: 'other-user', created_at: '2026-07-16T10:00:00Z' },
      })
    })

    expect(screen.getByText('hola')).toBeInTheDocument()
    expect(mockMarkConversationRead).toHaveBeenCalledTimes(2)
    expect(mockMarkConversationRead).toHaveBeenLastCalledWith('conv-1')
  })

  it('eco realtime de mensaje PROPIO no re-marca leída', async () => {
    renderConversation()
    await waitFor(() => expect(mockMarkConversationRead).toHaveBeenCalledTimes(1))

    await act(async () => {
      await capturedHandler!({
        new: { id: 'msg-2', content: 'mío', sender_id: 'me', created_at: '2026-07-16T10:01:00Z' },
      })
    })

    expect(screen.getByText('mío')).toBeInTheDocument()
    expect(mockMarkConversationRead).toHaveBeenCalledTimes(1)
  })
})
