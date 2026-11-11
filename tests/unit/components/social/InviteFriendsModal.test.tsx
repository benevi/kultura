// ============================================================
// KULTURA — InviteFriendsModal unit tests (E45-d.2)
// Carga de amigos invitables, estado vacío, invitar (POST + { data }),
// y cierre por overlay / stopPropagation en panel.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockShow = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, dismiss: vi.fn() }),
}))

import { InviteFriendsModal } from '@/components/social/InviteFriendsModal'

const FRIENDS = [
  { id: 'f1', username: 'ada', avatarColor: '#E82020', avatarInitials: 'AD' },
  { id: 'f2', username: 'bob', avatarColor: '#2050E8', avatarInitials: 'BO' },
]

function mockFetchFriends(friends = FRIENDS) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: friends }) })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InviteFriendsModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('carga amigos invitables al montar (GET) y los lista', async () => {
    mockFetchFriends()
    render(<InviteFriendsModal groupId="g1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/groups/g1/invitations', expect.anything())
  })

  it('muestra estado vacío si no hay invitables', async () => {
    mockFetchFriends([])
    render(<InviteFriendsModal groupId="g1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('noInvitableFriends')).toBeInTheDocument())
  })

  it('invitar hace POST con inviteeId y muestra toast de éxito', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: FRIENDS }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: 'inv-1',
            groupId: 'g1',
            inviterId: 'me',
            inviteeId: 'f1',
            status: 'pending',
            createdAt: '2026-06-01T00:00:00Z',
          },
        }),
      })
    global.fetch = fetchMock

    render(<InviteFriendsModal groupId="g1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('invite')[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/groups/g1/invitations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ inviteeId: 'f1' }),
        })
      )
    })
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'inviteSent', type: 'success' })
    )
    // El invitado desaparece de la lista
    await waitFor(() => expect(screen.queryByText('ada')).not.toBeInTheDocument())
  })

  it('toast de error si el POST falla ({ error: { code } })', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: FRIENDS }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ error: { code: 'forbidden', message: 'not_friends' } }),
      })
    global.fetch = fetchMock

    render(<InviteFriendsModal groupId="g1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('invite')[0])

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'inviteError', type: 'error' })
      )
    })
  })

  it('click en overlay cierra (onClose)', async () => {
    mockFetchFriends()
    const onClose = vi.fn()
    render(<InviteFriendsModal groupId="g1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en panel NO cierra (stopPropagation)', async () => {
    mockFetchFriends()
    const onClose = vi.fn()
    render(<InviteFriendsModal groupId="g1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('modal-panel'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
