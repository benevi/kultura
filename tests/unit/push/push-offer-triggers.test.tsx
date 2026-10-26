// F-33 (remate): pedir o aceptar una amistad ofrece los avisos push (solo si
// la acción sale bien; `PushOffer` decide luego si hay algo que ofrecer).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const actions = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  getBlockState: vi.fn(async () => ({ enabled: false, blocked: false })),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/social/actions', () => actions)

import { FriendshipButton } from '@/components/social/FriendshipButton'
import { FriendCard } from '@/components/social/FriendCard'
import { PUSH_OFFER_EVENT } from '@/lib/push/offer'

let offers: string[] = []
const listener = (e: Event) => offers.push((e as CustomEvent<string>).detail)

beforeEach(() => {
  offers = []
  Object.values(actions).forEach((fn) => fn.mockReset())
  actions.getBlockState.mockResolvedValue({ enabled: false, blocked: false })
  window.addEventListener(PUSH_OFFER_EVENT, listener)
})
afterEach(() => window.removeEventListener(PUSH_OFFER_EVENT, listener))

describe('ofrecer avisos tras una amistad', () => {
  it('al enviar la solicitud (y no si falla)', async () => {
    actions.sendFriendRequest.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined)
    render(<FriendshipButton initialStatus="none" targetUserId="u2" allowBlock={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    await waitFor(() => expect(actions.sendFriendRequest).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(offers).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    await waitFor(() => expect(offers).toEqual(['friends']))
  })

  it('al aceptar desde el perfil', async () => {
    actions.respondToFriendRequest.mockResolvedValue(undefined)
    render(<FriendshipButton initialStatus="pending_received" targetUserId="u2" friendshipId="f1" allowBlock={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'accept' }))
    await waitFor(() => expect(offers).toEqual(['friends']))
  })

  it('al aceptar desde la lista de solicitudes; rechazar no lo ofrece', async () => {
    actions.respondToFriendRequest.mockResolvedValue(undefined)
    const friendship = {
      id: 'f1',
      requesterId: 'u2',
      receiverId: 'me',
      status: 'pending' as const,
      createdAt: '2026-10-01',
      otherUser: { id: 'u2', username: 'ana', avatarColor: 'blue', avatarInitials: 'AN' },
    }
    const { unmount } = render(<FriendCard friendship={friendship as never} variant="pending" onAction={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /decline/ }))
    await waitFor(() => expect(actions.respondToFriendRequest).toHaveBeenCalledWith('f1', 'decline'))
    expect(offers).toEqual([])
    unmount()

    render(<FriendCard friendship={friendship as never} variant="pending" onAction={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /accept/ }))
    await waitFor(() => expect(offers).toEqual(['friends']))
  })
})
