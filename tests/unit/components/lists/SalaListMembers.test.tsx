// ============================================================
// KULTURA — Miembros de una lista en «Sala» (fase 8.5 L4): una fila por
// persona, «Quitar a @…» que dice a quién, confirmación con su nombre, el
// error dentro del diálogo, y el foco a «Miembros» al quitar. Invitar con
// `SalaSelect` etiquetado.
// ============================================================

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ListMember } from '@/types/list'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, v?: Record<string, unknown>) =>
    `${ns}.${key}${v ? `(${Object.values(v).join('|')})` : ''}`,
  useLocale: () => 'es',
}))

import { SalaListMembers } from '@/components/lists/sala/SalaListMembers'

const ANA = { id: 'u1', username: 'ana', avatarColor: 'pink', avatarInitials: 'AN', createdAt: '' }
const BEA: ListMember = { listId: 'l1', userId: 'u2', user: { id: 'u2', username: 'bea', avatarColor: 'lime', avatarInitials: 'BE' } as never }

function renderMembers(props: Partial<React.ComponentProps<typeof SalaListMembers>> = {}) {
  const onRemoveMember = vi.fn(async () => true)
  const onInvite = vi.fn()
  const utils = render(
    <SalaListMembers
      list={{ id: 'l1', owner: ANA }}
      members={[BEA]}
      isOwner
      onRemoveMember={onRemoveMember}
      invitableFriends={[{ id: 'u3', username: 'cris', avatarColor: 'blue', avatarInitials: 'CR' }]}
      inviteUserId=""
      onInviteUserIdChange={vi.fn()}
      inviting={false}
      onInvite={onInvite}
      {...props}
    />
  )
  return { ...utils, onRemoveMember, onInvite }
}

describe('SalaListMembers', () => {
  it('`h2`, dueño con «Propietario» y cada miembro con su enlace', () => {
    renderMembers()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('lists.membersTitle')
    const lista = screen.getByRole('list', { name: 'lists.membersTitle' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lista).getByRole('link', { name: '@ana' })).toHaveAttribute('href', '/profile/ana')
    expect(within(lista).getByText('lists.owner')).toBeTruthy()
  })

  it('quitar: el botón y la confirmación dicen a quién; al quitar, el foco va a «Miembros»', async () => {
    const { onRemoveMember } = renderMembers()
    fireEvent.click(screen.getByRole('button', { name: 'lists.sala.removeMemberNamed(bea)' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText('lists.sala.removeMemberTitle(bea)')).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(dialogo).getByRole('button', { name: 'lists.sala.removeMemberNamed(bea)' }))
    })
    expect(onRemoveMember).toHaveBeenCalledWith('u2')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('si falla, el error va dentro del diálogo y sigue abierto', async () => {
    renderMembers({ onRemoveMember: vi.fn(async () => false) })
    fireEvent.click(screen.getByRole('button', { name: 'lists.sala.removeMemberNamed(bea)' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'lists.sala.removeMemberNamed(bea)' }))
    })
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText('lists.removeMemberError')).toBeTruthy()
  })

  it('quien no es el dueño: sin «Quitar» ni invitar', () => {
    renderMembers({ isOwner: false })
    expect(screen.queryByRole('button', { name: /removeMemberNamed/ })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('invitar: selector etiquetado; «Invitar» apagado sin elegir y envía con alguien elegido', () => {
    const a = renderMembers()
    expect(screen.getByRole('combobox', { name: 'lists.inviteMember' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lists.invite' })).toBeDisabled()
    a.unmount()
    const b = renderMembers({ inviteUserId: 'u3' })
    fireEvent.click(screen.getByRole('button', { name: 'lists.invite' }))
    expect(b.onInvite).toHaveBeenCalled()
  })
})
