// ============================================================
// KULTURA — Acciones sobre otra persona en el perfil «Sala» (fase 8.5 P2):
// cada estado de amistad, «Dejar de ser amigos» y «Bloquear» con confirmación
// (Cancelar primero), los errores visibles y anunciados con «Reintentar», el
// foco tras cada acción y la denuncia en su versión de «Sala».
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const actions = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  getBlockState: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))

vi.mock('next-intl', () => {
  const t = (key: string, v?: Record<string, unknown>) => (v ? `${key}(${Object.values(v).join('|')})` : key)
  return { useTranslations: vi.fn(() => t), useLocale: () => 'es' }
})
vi.mock('@/lib/social/actions', () => actions)
vi.mock('@/components/social/ReportButton', () => ({
  ReportButton: (props: Record<string, unknown>) => <div data-testid="report" data-props={JSON.stringify(props)} />,
}))

import { SalaProfileSocial } from '@/components/profile/sala/SalaProfileSocial'
import { PUSH_OFFER_EVENT } from '@/lib/push/offer'

let offers: string[] = []
const listener = (e: Event) => offers.push((e as CustomEvent<string>).detail)

beforeEach(() => {
  offers = []
  Object.values(actions).forEach((fn) => fn.mockReset())
  actions.getBlockState.mockResolvedValue({ enabled: true, blocked: false })
  window.addEventListener(PUSH_OFFER_EVENT, listener)
})
afterEach(() => window.removeEventListener(PUSH_OFFER_EVENT, listener))

function renderSocial(initialStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted', friendshipId?: string) {
  return render(
    <SalaProfileSocial username="lucia" targetUserId="u2" initialStatus={initialStatus} friendshipId={friendshipId} />
  )
}

/** Lo que anuncia la región `status` de las acciones. */
const announced = (container: HTMLElement) => container.querySelector('p[role="status"]')?.textContent

describe('SalaProfileSocial: amistad', () => {
  it('sin relación: «Añadir amigo»; al enviar, el estado en texto, «Cancelar solicitud», el foco en él y el aviso de push', async () => {
    actions.sendFriendRequest.mockResolvedValue('f9')
    const { container } = renderSocial('none')
    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    const cancel = await screen.findByRole('button', { name: 'cancelRequest' })
    expect(actions.sendFriendRequest).toHaveBeenCalledWith('u2')
    expect(screen.getByText('requestSent', { selector: 'p[tabindex="-1"]' })).toBeInTheDocument()
    expect(announced(container)).toBe('requestSent')
    await waitFor(() => expect(cancel).toHaveFocus())
    expect(offers).toEqual(['friends'])

    actions.removeFriend.mockResolvedValue(undefined)
    fireEvent.click(cancel)
    await screen.findByRole('button', { name: 'addFriend' })
    expect(actions.removeFriend).toHaveBeenCalledWith('f9')
    expect(announced(container)).toBe('requestCancelled')
  })

  it('solicitud enviada sin id conocido: solo el estado, sin botón muerto; el foco va al texto', async () => {
    actions.sendFriendRequest.mockResolvedValue(undefined)
    renderSocial('none')
    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    const status = await screen.findByText('requestSent', { selector: 'p[tabindex="-1"]' })
    expect(screen.queryByRole('button', { name: 'cancelRequest' })).toBeNull()
    expect(screen.queryByRole('button', { name: /requestSent/ })).toBeNull()
    await waitFor(() => expect(status).toHaveFocus())
  })

  it('solicitud recibida: «Aceptar» y «Rechazar»', async () => {
    actions.respondToFriendRequest.mockResolvedValue(undefined)
    const { container } = renderSocial('pending_received', 'f1')
    expect(screen.getByText('requestReceived')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'decline' }))
    await screen.findByRole('button', { name: 'addFriend' })
    expect(actions.respondToFriendRequest).toHaveBeenCalledWith('f1', 'decline')
    expect(announced(container)).toBe('requestDeclined')
    expect(offers).toEqual([])
  })

  it('aceptar: «Sois amigos.» y el aviso de push', async () => {
    actions.respondToFriendRequest.mockResolvedValue(undefined)
    const { container } = renderSocial('pending_received', 'f1')
    fireEvent.click(screen.getByRole('button', { name: 'accept' }))
    await screen.findByRole('button', { name: 'unfriend' })
    expect(screen.getByText('youAreFriends')).toBeInTheDocument()
    expect(announced(container)).toBe('nowFriends')
    expect(offers).toEqual(['friends'])
  })

  it('amigos: «Dejar de ser amigos» pregunta antes, con el foco en «Cancelar», que va primero', async () => {
    actions.removeFriend.mockResolvedValue(undefined)
    renderSocial('accepted', 'f1')
    // Hoy «Amigos ✓» borraba la amistad de un toque: aquí no se borra nada sin confirmar.
    fireEvent.click(screen.getByRole('button', { name: 'unfriend' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'unfriendConfirmTitle(lucia)' })
    expect(actions.removeFriend).not.toHaveBeenCalled()
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['cancel', 'unfriend'])
    await waitFor(() => expect(buttons[0]).toHaveFocus())

    fireEvent.click(buttons[1])
    await screen.findByRole('button', { name: 'addFriend' })
    expect(actions.removeFriend).toHaveBeenCalledWith('f1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('si falla quitar la amistad, el error se ve dentro del diálogo, que sigue abierto', async () => {
    actions.removeFriend.mockRejectedValue(new Error('x'))
    renderSocial('accepted', 'f1')
    fireEvent.click(screen.getByRole('button', { name: 'unfriend' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'unfriend' }))
    await within(dialog).findByText('unfriendError')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('un error sin diálogo se ve, se anuncia (alert) y se puede reintentar', async () => {
    actions.sendFriendRequest.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('f2')
    const { container } = renderSocial('none')
    fireEvent.click(screen.getByRole('button', { name: 'addFriend' }))
    await waitFor(() => expect(container.querySelector('p[role="alert"]')?.textContent).toBe('sendError'))
    const notice = container.querySelector('[data-sala-notice="error"]') as HTMLElement
    expect(notice).toHaveTextContent('sendError')
    fireEvent.click(within(notice).getByRole('button', { name: 'tryAgain' }))
    await screen.findByRole('button', { name: 'cancelRequest' })
    expect(actions.sendFriendRequest).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-sala-notice]')).toBeNull()
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe('')
  })
})

describe('SalaProfileSocial: bloquear y denunciar', () => {
  it('«Bloquear» pregunta antes; al bloquear, la amistad desaparece y queda «Desbloquear»', async () => {
    actions.blockUser.mockResolvedValue(undefined)
    const { container } = renderSocial('accepted', 'f1')
    fireEvent.click(await screen.findByRole('button', { name: 'block' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'blockConfirmTitle' })
    expect(actions.blockUser).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'block' }))
    const unblock = await screen.findByRole('button', { name: 'unblock' })
    expect(actions.blockUser).toHaveBeenCalledWith('u2')
    expect(screen.queryByRole('button', { name: 'unfriend' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'block' })).toBeNull()
    expect(announced(container)).toBe('blockedNotice')
    await waitFor(() => expect(unblock).toHaveFocus())

    // Al desbloquear se parte de cero: la amistad ya no existe.
    actions.unblockUser.mockResolvedValue(undefined)
    fireEvent.click(unblock)
    await screen.findByRole('button', { name: 'addFriend' })
    expect(announced(container)).toBe('unblockedNotice')
  })

  it('sin moderación disponible no hay «Bloquear»; ya bloqueada, solo «Desbloquear»', async () => {
    actions.getBlockState.mockRejectedValueOnce(new Error('x'))
    const { unmount } = renderSocial('none')
    await waitFor(() => expect(actions.getBlockState).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'block' })).toBeNull()
    unmount()

    actions.getBlockState.mockResolvedValueOnce({ enabled: true, blocked: true })
    renderSocial('none')
    await screen.findByRole('button', { name: 'unblock' })
    expect(screen.queryByRole('button', { name: 'addFriend' })).toBeNull()
  })

  it('«Denunciar» es el de «Sala» (diálogo), con el nombre de cerrar', () => {
    renderSocial('none')
    expect(JSON.parse(screen.getByTestId('report').dataset.props!)).toEqual({
      targetType: 'user',
      targetId: 'u2',
      skin: 'sala',
      closeLabel: 'close',
    })
  })

  it('todos los botones son de «Sala» (48 px); ninguno deshabilitado', async () => {
    renderSocial('pending_received', 'f1')
    await screen.findByRole('button', { name: 'block' })
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toBeDisabled()
      expect(button.className).toMatch(/h-sala-target|min-h-sala-target/)
    }
  })
})
