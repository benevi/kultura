// ============================================================
// KULTURA — /chat/[id]: caracterización de ConversationClient (C12).
//
// Fija el HTML (textos, clases, orden, ids, aria) y el comportamiento que los
// otros tests no cubrían, para partir el componente sin cambiar nada:
// canal realtime y su limpieza, envío optimista y su reconciliación (también
// cuando el eco realtime llega antes que la respuesta del POST), errores al
// enviar, paginación hacia atrás (sin mover lo que se lee), reintento de la
// carga, Esc en las opciones y error al borrar un mensaje.
// ============================================================

import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// La hora de cada mensaje no depende de la zona de la máquina.
process.env.TZ = 'UTC'

const { mockPush, mockShow, mockMarkRead, rt } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockShow: vi.fn(),
  mockMarkRead: vi.fn(),
  rt: {
    channelName: null as string | null,
    onArgs: null as unknown[] | null,
    handler: null as ((p: { new: Record<string, unknown> }) => Promise<void>) | null,
    channel: { id: 'canal' } as Record<string, unknown>,
    removeChannel: null as null | ((c: unknown) => void),
    lookups: [] as string[],
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))
vi.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ initials, color, size }: { initials: string; color: string; size: string }) => (
    <div data-testid="avatar" data-initials={initials} data-color={color} data-size={size} />
  ),
}))
vi.mock('@/components/ui/ToastProvider', () => ({ useToastContext: () => ({ show: mockShow }) }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  useUnreadChat: () => ({ unreadCount: 0, refreshUnread: () => {}, markConversationRead: mockMarkRead }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      rt.channelName = name
      const chain = {
        on: (...args: unknown[]) => {
          rt.onArgs = args.slice(0, 2)
          rt.handler = args[2] as typeof rt.handler
          return chain
        },
        subscribe: () => rt.channel,
      }
      return chain
    },
    removeChannel: (c: unknown) => rt.removeChannel?.(c),
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            rt.lookups.push(`${table}|${cols}|${col}=${val}`)
            return { data: val === 'me' ? null : { username: 'troll', avatar_color: '#000', avatar_initials: 'TR' } }
          },
        }),
      }),
    }),
  }),
}))

import { ConversationClient } from '@/app/[locale]/(app)/chat/[id]/ConversationClient'

const otherUser = { id: 'other-user', username: 'troll', avatar_color: '#000', avatar_initials: 'TR' }
const MSGS = [
  { id: 'm-1', content: 'hola', sender_id: 'other-user', created_at: '2026-11-01T10:00:00Z', users: { username: 'troll', avatar_color: '#000', avatar_initials: 'TR' } },
  { id: 'm-2', content: 'lo mío', sender_id: 'me', created_at: '2026-11-01T10:01:00Z', users: null },
  { id: 'm-3', content: '', sender_id: null, created_at: '2026-11-01T10:02:00Z', users: null },
  { id: 'm-4', content: 'sin perfil', sender_id: 'other-user', created_at: '2026-11-01T10:03:00Z', users: null },
]

const mockFetch = vi.fn()
type Handler = (url: string, init?: RequestInit) => unknown
function routeFetch(handlers: Record<string, Handler>) {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const h = handlers[`${init?.method ?? 'GET'} ${url}`]
    if (!h) return { ok: true, status: 200, json: async () => ({ data: null }) }
    return h(url, init)
  })
}
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) })
const fail = (status: number, error: Record<string, unknown>) => ({
  ok: false, status, headers: new Headers(), json: async () => ({ error }),
})
const page = (messages: unknown[], hasMore = false) => ok({ messages, hasMore, currentUserId: 'me' })
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function renderConv(props: Partial<React.ComponentProps<typeof ConversationClient>> = {}) {
  return render(<ConversationClient conversationId="conv-1" otherUser={otherUser} currentUserId="me" {...props} />)
}
const html = () => document.body.innerHTML

beforeEach(() => {
  mockFetch.mockReset()
  mockPush.mockReset()
  mockShow.mockReset()
  mockMarkRead.mockReset()
  rt.channelName = null
  rt.onArgs = null
  rt.handler = null
  rt.removeChannel = vi.fn()
  rt.lookups = []
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('ConversationClient: HTML (caracterización)', () => {
  it('cargando', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderConv()
    expect(html()).toMatchSnapshot()
  })

  it('con mensajes (ajeno, propio, huérfano, sin perfil) y página anterior', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page(MSGS, true) })
    renderConv()
    await screen.findByText('lo mío')
    await waitFor(() => expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite'))
    expect(html()).toMatchSnapshot()
  })

  it('vacía y con el otro fuera del chat', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page([]) })
    renderConv({ otherUser: null })
    await screen.findByText('chat.messagePlaceholder', { selector: 'div' })
    expect(html()).toMatchSnapshot()
  })

  it('error de carga', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => fail(500, { code: 'internal' }) })
    renderConv()
    await screen.findByRole('alert')
    expect(html()).toMatchSnapshot()
  })

  it('sin poder escribir', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page(MSGS) })
    renderConv({ canSend: false })
    await screen.findByText('hola')
    expect(html()).toMatchSnapshot()
  })

  it('opciones abiertas, confirmación de bloqueo, de salida y aviso de bloqueado', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page(MSGS),
      'POST /api/friends/blocks': () => ok(null),
    })
    renderConv()
    await screen.findByText('hola')
    const toggle = screen.getByRole('button', { name: 'moderation.conversationOptions' })
    fireEvent.click(toggle)
    expect(toggle.parentElement!.outerHTML).toMatchSnapshot('abiertas')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.blockUser(troll)' }))
    expect(toggle.parentElement!.outerHTML).toMatchSnapshot('bloquear')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'moderation.leave' }))
    expect(toggle.parentElement!.outerHTML).toMatchSnapshot('salir')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'moderation.blockUser(troll)' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'moderation.block' }))
    })
    await screen.findByText('moderation.blockedNotice')
    expect(html()).toMatchSnapshot('bloqueado')
  })

  it('confirmación de borrar un mensaje propio', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page(MSGS) })
    renderConv()
    await screen.findByText('lo mío')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.deleteMessage' }))
    expect(screen.getByRole('log').outerHTML).toMatchSnapshot()
  })
})

describe('ConversationClient: realtime (caracterización)', () => {
  it('se suscribe al canal de la conversación con su filtro y lo quita al desmontar', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page([]) })
    const { unmount } = renderConv()
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('conv-1'))
    expect(rt.channelName).toBe('conversation:conv-1')
    expect(rt.onArgs).toEqual([
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.conv-1' },
    ])
    unmount()
    expect(rt.removeChannel).toHaveBeenCalledWith(rt.channel)
  })

  it('un mensaje ajeno busca al autor, se pinta con su perfil, desplaza suave y no duplica', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page([]) })
    renderConv()
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledTimes(1))
    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()
    const msg = { id: 'r-1', content: 'nuevo', sender_id: 'other-user', created_at: '2026-11-01T11:00:00Z' }
    await act(async () => { await rt.handler!({ new: msg }) })
    expect(rt.lookups).toEqual(['users|username, avatar_color, avatar_initials|id=other-user'])
    expect(screen.getByText('nuevo')).toBeInTheDocument()
    expect(screen.getByText('troll', { selector: 'span' })).toBeInTheDocument()
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' }))
    await act(async () => { await rt.handler!({ new: msg }) })
    expect(screen.getAllByText('nuevo')).toHaveLength(1)
  })

  it('si el eco realtime llega antes que la respuesta del POST, reemplaza el temporal', async () => {
    const post = deferred<unknown>()
    routeFetch({
      'GET /api/chat/conv-1': () => page([]),
      'POST /api/chat/conv-1': () => post.promise,
    })
    renderConv()
    const input = await screen.findByLabelText('chat.messageLabel')
    fireEvent.change(input, { target: { value: 'hola eco' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByText('hola eco')).toBeInTheDocument()
    await act(async () => {
      await rt.handler!({ new: { id: 'real-1', content: 'hola eco', sender_id: 'me', created_at: '2026-11-01T11:00:00Z' } })
    })
    expect(screen.getAllByText('hola eco')).toHaveLength(1)
    // Ya es el real: tiene el botón de borrar.
    expect(screen.getByRole('button', { name: 'moderation.deleteMessage' })).toBeInTheDocument()
    await act(async () => {
      post.resolve(ok({ id: 'real-1', content: 'hola eco', sender_id: 'me', created_at: '2026-11-01T11:00:00Z' }))
    })
    expect(screen.getAllByText('hola eco')).toHaveLength(1)
    expect(mockMarkRead).toHaveBeenCalledTimes(1)
  })
})

describe('ConversationClient: envío (caracterización)', () => {
  it('optimista: limpia el campo, pinta el temporal sin acciones, bloquea el botón y manda el texto recortado', async () => {
    const post = deferred<unknown>()
    routeFetch({
      'GET /api/chat/conv-1': () => page([]),
      'POST /api/chat/conv-1': () => post.promise,
    })
    renderConv()
    const input = (await screen.findByLabelText('chat.messageLabel')) as HTMLInputElement
    const send = screen.getByRole('button', { name: 'chat.send' })
    expect(send).toBeDisabled()
    fireEvent.change(input, { target: { value: '   ' } })
    expect(send).toBeDisabled()
    fireEvent.submit(input.closest('form')!)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    fireEvent.change(input, { target: { value: '  hola  ' } })
    expect(send).not.toBeDisabled()
    fireEvent.click(send)
    expect(input.value).toBe('')
    expect(screen.getByText('hola')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'moderation.deleteMessage' })).not.toBeInTheDocument()
    const [, init] = mockFetch.mock.calls.find((c) => c[1]?.method === 'POST')!
    expect(JSON.parse(init.body)).toEqual({ content: 'hola' })

    // Mientras se envía, otro texto no sale.
    fireEvent.change(input, { target: { value: 'otro' } })
    expect(send).toBeDisabled()

    await act(async () => {
      post.resolve(ok({ id: 'real-1', content: 'hola', sender_id: 'me', created_at: '2026-11-01T11:00:00Z' }))
    })
    expect(screen.getByRole('button', { name: 'moderation.deleteMessage' })).toBeInTheDocument()
    expect(send).not.toBeDisabled()
  })

  it('si falla, quita el temporal, devuelve el texto y avisa', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page([]),
      'POST /api/chat/conv-1': () => fail(500, { code: 'internal' }),
    })
    renderConv()
    const input = (await screen.findByLabelText('chat.messageLabel')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hola' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'chat.send' })) })
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith({ message: 'chat.sendError', type: 'error' }))
    expect(input.value).toBe('hola')
    expect(screen.queryByText('hola', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('un 403 que no es cannot_message avisa y deja el campo', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page([]),
      'POST /api/chat/conv-1': () => fail(403, { code: 'forbidden', message: 'otro' }),
    })
    renderConv()
    const input = await screen.findByLabelText('chat.messageLabel')
    fireEvent.change(input, { target: { value: 'hola' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'chat.send' })) })
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith({ message: 'chat.sendError', type: 'error' }))
    expect(screen.getByLabelText('chat.messageLabel')).toBeInTheDocument()
  })
})

describe('ConversationClient: carga y paginación (caracterización)', () => {
  it('el reintento tras un error vuelve a pedir la conversación', async () => {
    let n = 0
    routeFetch({ 'GET /api/chat/conv-1': () => (n++ === 0 ? fail(500, { code: 'internal' }) : page(MSGS)) })
    renderConv()
    fireEvent.click(await screen.findByRole('button', { name: 'chat.retry' }))
    expect(screen.getByRole('status')).toHaveTextContent('chat.loadingMessages')
    await screen.findByText('hola')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockMarkRead).toHaveBeenCalledTimes(1)
  })

  it('«anteriores» pide con before=, añade arriba sin duplicar y conserva la posición', async () => {
    const older = [
      { id: 'o-1', content: 'antiguo', sender_id: 'other-user', created_at: '2026-10-01T10:00:00Z', users: null },
      MSGS[0],
    ]
    routeFetch({
      'GET /api/chat/conv-1': () => page(MSGS, true),
      [`GET /api/chat/conv-1?before=${encodeURIComponent(MSGS[0].created_at)}`]: () => page(older, false),
    })
    renderConv()
    await screen.findByText('hola')
    const log = screen.getByRole('log')
    // Alto proporcional a los mensajes pintados; el frame se ejecuta después
    // del render, como en el navegador.
    Object.defineProperty(log, 'scrollHeight', {
      configurable: true,
      get: () => log.querySelectorAll('.rounded-bento').length * 100,
    })
    log.scrollTop = 10
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return 0 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'chat.loadOlder' })) })
    await screen.findByText('antiguo')
    expect(frames).toHaveLength(1)
    frames[0](0)
    expect(screen.getAllByText('hola')).toHaveLength(1)
    const texts = Array.from(log.querySelectorAll('.rounded-bento')).map((n) => n.textContent)
    expect(texts[0]).toBe('antiguo')
    expect(log.scrollTop).toBe(110)
    expect(screen.queryByRole('button', { name: 'chat.loadOlder' })).not.toBeInTheDocument()
  })

  it('si fallan los anteriores avisa y deja el botón', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page(MSGS, true),
      [`GET /api/chat/conv-1?before=${encodeURIComponent(MSGS[0].created_at)}`]: () => fail(500, { code: 'internal' }),
    })
    renderConv()
    await screen.findByText('hola')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'chat.loadOlder' })) })
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith({ message: 'chat.loadError', type: 'error' }))
    expect(screen.getByRole('button', { name: 'chat.loadOlder' })).toBeInTheDocument()
  })
})

describe('ConversationClient: opciones y borrado (caracterización)', () => {
  it('Esc cierra las opciones y devuelve el foco al botón; con una confirmación abierta, no', async () => {
    routeFetch({ 'GET /api/chat/conv-1': () => page(MSGS) })
    renderConv()
    await screen.findByText('hola')
    const toggle = screen.getByRole('button', { name: 'moderation.conversationOptions' })
    fireEvent.click(toggle)
    const panelId = toggle.getAttribute('aria-controls')!
    const panel = document.getElementById(panelId)!
    fireEvent.click(screen.getByRole('button', { name: 'moderation.leave' }))
    fireEvent.keyDown(document.getElementById(panelId)!, { key: 'Escape' })
    expect(document.getElementById(panelId)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'moderation.cancel' }))
    expect(panel.isConnected).toBe(true)
    fireEvent.keyDown(document.getElementById(panelId)!, { key: 'Escape' })
    expect(document.getElementById(panelId)).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('error al bloquear y al salir: se explica y no navega', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page(MSGS),
      'POST /api/friends/blocks': () => fail(500, { code: 'internal' }),
      'DELETE /api/chat/conv-1': () => fail(500, { code: 'internal' }),
    })
    renderConv()
    await screen.findByText('hola')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.conversationOptions' }))
    fireEvent.click(screen.getByRole('button', { name: 'moderation.blockUser(troll)' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'moderation.block' })) })
    expect(await screen.findByText('moderation.blockError')).toBeInTheDocument()
    expect(screen.getByLabelText('chat.messageLabel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'moderation.cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'moderation.leave' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'moderation.leave' }))
    })
    expect(await screen.findByText('moderation.leaveError')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('error al borrar un mensaje: lo explica y el mensaje sigue', async () => {
    routeFetch({
      'GET /api/chat/conv-1': () => page(MSGS),
      'DELETE /api/chat/conv-1/messages/m-2': () => fail(500, { code: 'internal' }),
    })
    renderConv()
    await screen.findByText('lo mío')
    fireEvent.click(screen.getByRole('button', { name: 'moderation.deleteMessage' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'moderation.delete' })) })
    expect(await screen.findByText('moderation.deleteMessageError')).toBeInTheDocument()
    expect(screen.getByText('lo mío')).toBeInTheDocument()
  })
})
