// ============================================================
// KULTURA — Chat con moderación (F-11): denunciar mensaje, borrar el propio,
// bloquear, salir y explicar por qué ya no se puede escribir.
// ============================================================

import { screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderEs } from './intl'

// Funciones estables: una nueva en cada render dispararía el efecto de carga en bucle.
const { mockPush, unread } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  unread: { unreadCount: 0, refreshUnread: () => {}, markConversationRead: () => {} },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }))
vi.mock('@/components/ui/ToastProvider', () => ({ useToastContext: () => ({ show: vi.fn() }) }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  useUnreadChat: () => unread,
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => {
      const chain = { on: () => chain, subscribe: () => chain }
      return chain
    },
    removeChannel: vi.fn(),
  }),
}))

import { ConversationClient } from '@/app/[locale]/(app)/chat/[id]/ConversationClient'

const otherUser = { id: 'other-user', username: 'troll', avatar_color: '#000', avatar_initials: 'TR' }
const messages = [
  { id: 'm-1', content: 'insulto', sender_id: 'other-user', created_at: '2026-11-01T10:00:00Z', users: { username: 'troll', avatar_color: '#000', avatar_initials: 'TR' } },
  { id: 'm-2', content: 'lo mío', sender_id: 'me', created_at: '2026-11-01T10:01:00Z', users: null },
]

const mockFetch = vi.fn()

function routeFetch(handlers: Record<string, (init?: RequestInit) => unknown>) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const h = handlers[key]
    if (!h) return { ok: true, status: 200, json: async () => ({}) }
    return h(init)
  })
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  mockFetch.mockReset()
  mockPush.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('ConversationClient con MODERATION_V2', () => {
  it('sin moderación no hay botones nuevos', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => ok({ messages }) })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" />)
    await screen.findByText('insulto')
    expect(screen.queryByRole('button', { name: /denunciar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Opciones de la conversación' })).not.toBeInTheDocument()
  })

  it('cada mensaje ajeno tiene "Denunciar mensaje: <autor>" y el propio "Borrar mi mensaje"', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => ok({ messages }) })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" moderation />)
    await screen.findByText('insulto')
    expect(screen.getByRole('button', { name: 'Denunciar mensaje: troll' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Denunciar mensaje/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Borrar mi mensaje' })).toBeInTheDocument()
  })

  it('borrar el propio pide confirmación y lo quita de la lista', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => ok({ messages }),
      'DELETE /api/chat/conv-1/messages/m-2': () => ok({ ok: true }),
    })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" moderation />)
    await screen.findByText('lo mío')
    fireEvent.click(screen.getByRole('button', { name: 'Borrar mi mensaje' }))
    const confirm = screen.getByRole('group', { name: '¿Borrar este mensaje?' })
    expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Borrar' }))
    })
    await waitFor(() => expect(screen.queryByText('lo mío')).not.toBeInTheDocument())
  })

  it('opciones: desplegable con aria-expanded; bloquear confirma y cierra el campo de texto con explicación', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => ok({ messages }),
      'POST /api/friends/blocks': () => ok({ ok: true }),
    })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" moderation />)
    await screen.findByText('insulto')
    const toggle = screen.getByRole('button', { name: 'Opciones de la conversación' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Denunciar usuario: troll' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear a troll' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group', { name: '¿Bloquear a este usuario?' })).getByRole('button', { name: 'Bloquear' }))
    })
    expect(await screen.findByText(/Ya no podéis escribiros/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument()
    expect(JSON.parse(mockFetch.mock.calls.find((c) => c[0] === '/api/friends/blocks')![1].body)).toEqual({ userId: 'other-user' })
  })

  it('salir del chat confirma, llama a DELETE y vuelve a la lista', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => ok({ messages }),
      'DELETE /api/chat/conv-1': () => ok({ ok: true }),
    })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" moderation />)
    await screen.findByText('insulto')
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la conversación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salir del chat' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group', { name: '¿Salir de esta conversación?' })).getByRole('button', { name: 'Salir del chat' }))
    })
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/chat'))
  })

  it('canSend=false (sin amistad o con bloqueo): no hay campo, hay explicación', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => ok({ messages }) })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" moderation canSend={false} />)
    await screen.findByText('insulto')
    expect(screen.getByRole('status')).toHaveTextContent('Ya no podéis escribiros')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('si el servidor responde 403 cannot_message al enviar, se explica en lugar del campo', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => ok({ messages: [] }),
      'POST /api/chat/conv-1': () => ({ ok: false, status: 403, json: async () => ({ error: 'cannot_message' }) }),
    })
    renderEs(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" />)
    const input = await screen.findByRole('textbox', { name: 'Mensaje' })
    fireEvent.change(input, { target: { value: 'hola' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    })
    expect(await screen.findByText(/Ya no podéis escribiros/)).toBeInTheDocument()
  })
})
