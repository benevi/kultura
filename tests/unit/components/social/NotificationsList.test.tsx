// ============================================================
// KULTURA — NotificationsList unit tests (E45-d.2)
// Cubre el branch group_invite: render del texto + iconos,
// y los botones Aceptar (PATCH) / Rechazar (DELETE).
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}))

const mockRefresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockShow = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, dismiss: vi.fn() }),
}))

import { NotificationsList } from '@/app/[locale]/(app)/notifications/NotificationsList'
import type { AppNotification } from '@/lib/social/notifications'

function groupInvite(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    type: 'group_invite',
    payload: {
      groupId: 'g1',
      groupName: 'Cinéfilos',
      invitationId: 'inv1',
      fromUserId: 'u2',
      fromUsername: 'ada',
    },
    readAt: null,
    createdAt: '2026-06-04T10:00:00Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationsList — group_invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('renderiza texto de invitación con username y nombre del grupo', () => {
    render(<NotificationsList notifications={[groupInvite()]} />)
    expect(screen.getByText('ada')).toBeInTheDocument()
    expect(screen.getByText('groupInvite')).toBeInTheDocument()
    expect(screen.getByText('Cinéfilos')).toBeInTheDocument()
  })

  it('muestra botones Aceptar y Rechazar para invitación no leída', () => {
    render(<NotificationsList notifications={[groupInvite()]} />)
    expect(screen.getByText('accept')).toBeInTheDocument()
    expect(screen.getByText('reject')).toBeInTheDocument()
  })

  it('no muestra botones si la invitación ya está leída', () => {
    render(<NotificationsList notifications={[groupInvite({ readAt: '2026-06-04T11:00:00Z' })]} />)
    expect(screen.queryByText('accept')).not.toBeInTheDocument()
    expect(screen.queryByText('reject')).not.toBeInTheDocument()
  })

  it('Aceptar hace PATCH al endpoint y refresca', async () => {
    render(<NotificationsList notifications={[groupInvite()]} />)
    fireEvent.click(screen.getByText('accept'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/invitations/inv1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'inviteAccepted', type: 'success' })
    )
  })

  it('Rechazar hace DELETE al endpoint y refresca', async () => {
    render(<NotificationsList notifications={[groupInvite()]} />)
    fireEvent.click(screen.getByText('reject'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/groups/invitations/inv1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'inviteRejected', type: 'success' })
    )
  })

  it('muestra toast de error si la acción falla (res.ok=false)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'x' }) })
    render(<NotificationsList notifications={[groupInvite()]} />)
    fireEvent.click(screen.getByText('accept'))
    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'inviteActionError', type: 'error' })
      )
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('tras aceptar oculta los botones de la invitación', async () => {
    render(<NotificationsList notifications={[groupInvite()]} />)
    fireEvent.click(screen.getByText('accept'))
    await waitFor(() => {
      expect(screen.queryByText('accept')).not.toBeInTheDocument()
    })
  })
})
