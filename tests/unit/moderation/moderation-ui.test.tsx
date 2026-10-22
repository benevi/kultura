// ============================================================
// KULTURA — UI de moderación (F-11): posts de grupo, expulsar, bloquear y
// formulario público de denuncia.
// ============================================================

import { screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderEs } from './intl'

const { mockRefresh, posts } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  posts: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: posts, error: null }).then(resolve),
    }
    return {
      from: () => q,
      channel: () => {
        const chain = { on: () => chain, subscribe: () => chain }
        return chain
      },
      removeChannel: vi.fn(),
    }
  },
}))

import { GroupFeed } from '@/app/[locale]/(app)/groups/[id]/GroupFeed'
import { MemberRemoveButton } from '@/app/[locale]/(app)/groups/[id]/MemberRemoveButton'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import { PublicReportForm } from '@/app/[locale]/report/PublicReportForm'

const mockFetch = vi.fn()
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  mockFetch.mockReset()
  mockRefresh.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  posts.length = 0
  posts.push(
    { id: 'p-mine', content: 'mi post', created_at: new Date().toISOString(), user_id: 'me', users: { username: 'yo', avatar_color: '#000', avatar_initials: 'YO' } },
    { id: 'p-other', content: 'post ajeno', created_at: new Date().toISOString(), user_id: 'ana', users: { username: 'ana', avatar_color: '#000', avatar_initials: 'AN' } },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('GroupFeed', () => {
  it('sin moderación: solo se puede borrar lo propio; nada de denunciar', async () => {
    renderEs(<GroupFeed groupId="g1" currentUserId="me" />)
    await screen.findByText('post ajeno')
    expect(screen.getByRole('button', { name: 'Borrar mi publicación' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Denunciar publicación/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar la publicación de ana' })).not.toBeInTheDocument()
  })

  it('con moderación, un miembro denuncia lo ajeno pero no lo borra', async () => {
    renderEs(<GroupFeed groupId="g1" currentUserId="me" moderation />)
    await screen.findByText('post ajeno')
    expect(screen.getByRole('button', { name: 'Denunciar publicación: ana' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar la publicación de ana' })).not.toBeInTheDocument()
  })

  it('el dueño borra un post ajeno tras confirmar', async () => {
    mockFetch.mockResolvedValue(ok({ ok: true }))
    renderEs(<GroupFeed groupId="g1" currentUserId="me" isOwner moderation />)
    await screen.findByText('post ajeno')
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la publicación de ana' }))
    const confirm = screen.getByRole('group', { name: '¿Borrar la publicación de ana?' })
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Borrar' }))
    })
    await waitFor(() => expect(screen.queryByText('post ajeno')).not.toBeInTheDocument())
    expect(mockFetch).toHaveBeenCalledWith('/api/groups/g1/posts/p-other', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('MemberRemoveButton', () => {
  it('expulsar pide confirmación, llama a la API y anuncia el resultado', async () => {
    mockFetch.mockResolvedValue(ok({ ok: true }))
    renderEs(<MemberRemoveButton groupId="g1" userId="u-2" username="ana" />)
    fireEvent.click(screen.getByRole('button', { name: 'Expulsar a ana' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group', { name: '¿Expulsar a ana?' })).getByRole('button', { name: 'Expulsar' }))
    })
    expect(await screen.findByRole('status')).toHaveTextContent('ana ya no está en el grupo.')
    expect(mockFetch).toHaveBeenCalledWith('/api/groups/g1/members/u-2', expect.objectContaining({ method: 'DELETE' }))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('cancelar devuelve el foco al botón', () => {
    renderEs(<MemberRemoveButton groupId="g1" userId="u-2" username="ana" />)
    fireEvent.click(screen.getByRole('button', { name: 'Expulsar a ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Expulsar a ana' })).toHaveFocus()
  })
})

describe('FriendshipButton — bloquear', () => {
  it('si la moderación no está disponible no pinta "Bloquear"', async () => {
    mockFetch.mockResolvedValue(ok({ enabled: false, blocked: false }))
    renderEs(<FriendshipButton initialStatus="accepted" targetUserId="u-2" friendshipId="f-1" />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument()
  })

  it('bloquear confirma, quita el botón de amistad y ofrece desbloquear', async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? ok({ ok: true }) : ok({ enabled: true, blocked: false }),
    )
    renderEs(<FriendshipButton initialStatus="accepted" targetUserId="u-2" friendshipId="f-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bloquear' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('group', { name: '¿Bloquear a este usuario?' })).getByRole('button', { name: 'Bloquear' }))
    })
    expect(await screen.findByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Amigos/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Has bloqueado a este usuario.')
  })

  it('allowBlock={false} no consulta nada', () => {
    renderEs(<FriendshipButton initialStatus="none" targetUserId="u-2" allowBlock={false} />)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('PublicReportForm', () => {
  it('sin rellenar: resumen de error enfocado y cada campo marcado', async () => {
    renderEs(<PublicReportForm types={['user', 'media']} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    })
    const alerts = screen.getAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('Revisa los campos marcados.')
    expect(alerts[0]).toHaveFocus()
    expect(screen.getByLabelText('Enlace o identificador')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Tu correo electrónico')).toHaveAttribute('aria-invalid', 'true')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('con el contenido ya fijado por la URL envía y muestra la referencia enfocada', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ reportId: 'r1', reference: 'KR-12345678' }) })
    renderEs(<PublicReportForm types={['user', 'media', 'list']} presetType="list" presetTarget="lista-1" />)
    expect(screen.getByText(/Una lista pública/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Spam o estafa' }))
    fireEvent.change(screen.getByLabelText('Qué ocurre'), { target: { value: 'Enlaces a webs de apuestas' } })
    fireEvent.change(screen.getByLabelText('Tu correo electrónico'), { target: { value: 'vecina@example.com' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /buena fe/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    })
    const done = await screen.findByRole('status')
    expect(done).toHaveTextContent('KR-12345678')
    await waitFor(() => expect(done).toHaveFocus())
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      targetType: 'list',
      target: 'lista-1',
      reason: 'spam',
      contactEmail: 'vecina@example.com',
      goodFaith: true,
      website: '',
    })
  })

  it('un 404 marca el campo del enlace', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'target_not_found', field: 'target' }) })
    renderEs(<PublicReportForm types={['user']} />)
    fireEvent.change(screen.getByLabelText('Enlace o identificador'), { target: { value: '@nadie' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Spam o estafa' }))
    fireEvent.change(screen.getByLabelText('Qué ocurre'), { target: { value: 'Perfil falso que suplanta' } })
    fireEvent.change(screen.getByLabelText('Tu correo electrónico'), { target: { value: 'a@b.es' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /buena fe/ }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    })
    expect(await screen.findByText('No encontramos ese contenido. Comprueba el enlace.')).toBeInTheDocument()
    expect(screen.getByLabelText('Enlace o identificador')).toHaveAttribute('aria-invalid', 'true')
  })

  it('la trampa para bots no está en el orden de foco ni en el árbol accesible', () => {
    const { container } = renderEs(<PublicReportForm types={['user']} />)
    const trap = container.querySelector('input[name="website"]')!
    expect(trap).toHaveAttribute('tabindex', '-1')
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
